/**
 * InPETU Hub — CRM do hub de inovação (Visitante · Gestor · Prestador)
 * ─────────────────────────────────────────────────────────────────────────────
 * Arquivo único em React + TypeScript + Tailwind CSS (utilitários básicos) com
 * ícones lucide-react. Sem backend: o estado vive em memória (useReducer) e
 * recarregar a página restaura os dados de exemplo.
 *
 * Organização (modularidade):
 *   1. Tipos                      5. Componentes de UI (biblioteca "Components" do Figma)
 *   2. Constantes e dados         6. Telas do Visitante
 *   3. Regras de negócio (puras)  7. Telas do Gestor
 *   4. Estado global (reducer)    8. Telas do Prestador
 *                                 9. App (cabeçalho, sessões e roteamento)
 *
 * Demonstração: Gestor  marina.costa@inpetuhub.ufsc.br  / gestor123
 *               Prestador carlos.menezes@servicos.com.br / prestador123
 * (já preenchidos nas telas de login). "Hoje" é simulado em 14/10/2026
 * (mude com VITE_HOJE_SIMULADO; um valor que não seja data, como "real", usa o relógio).
 *
 */
import React, {
  useState,
  useReducer,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  createContext,
  useContext,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  History,
  Inbox,
  Landmark,
  LifeBuoy,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Send,
  Upload,
  User,
  Users,
  Wrench,
  X,
} from 'lucide-react';


/* ═════════════════════════════════════════════════════════════════════════════
   1 · TIPOS
   ═════════════════════════════════════════════════════════════════════════════ */

type Perfil = 'visitante' | 'gestor' | 'prestador';
type TipoSolicitante = 'Empreendedor' | 'Residente' | 'Visitante' | 'Instituição';
type StatusPedido = 'Pendente' | 'Confirmada' | 'Recusada'; // reservas e visitas
type StatusChamado = 'Aberto' | 'Em andamento' | 'Resolvido' | 'Fechado';
type Arte = 'auditorio' | 'sala' | 'mentoria' | 'generico';
type Tom = 'ok' | 'aviso' | 'erro' | 'info' | 'neutro';
type Autor = 'Gestor' | 'Prestador' | 'Sistema';
type RefHistorico = 'reserva' | 'visita' | 'chamado';

interface Espaco {
  id: string;
  nome: string;
  tipo: string;
  capacidade: number;
  descricao: string;
  recursos: string[];
  ativo: boolean;
  arte: Arte;
  /** URL opcional; sem ela o protótipo desenha uma ilustração própria. */
  foto?: string;
  /** Nomes dos arquivos "enviados" no cadastro (simulado). */
  fotos: string[];
}

interface Solicitante {
  id: string;
  nome: string;
  tipo: TipoSolicitante;
  empresa: string;
  email: string;
  telefone: string; // só dígitos
}

interface Reserva {
  id: string;
  espacoId: string;
  data: string; // ISO aaaa-mm-dd
  inicio: string; // HH:MM
  fim: string;
  nome: string;
  email: string;
  telefone: string;
  empresa: string;
  tipo: TipoSolicitante;
  participantes: number;
  finalidade: string;
  status: StatusPedido;
  acimaCapacidade: boolean;
  motivoRecusa?: string;
  confirmadaNaSessao?: boolean;
  criadoEm: string; // aaaa-mm-ddTHH:MM
}

interface Visita {
  id: string;
  instituicao: string;
  email: string;
  telefone: string;
  data: string;
  inicio: string;
  fim: string;
  visitantes: number;
  objetivo: string;
  status: StatusPedido;
  motivoRecusa?: string;
  confirmadaNaSessao?: boolean;
  criadoEm: string;
}

interface Reuniao {
  id: string;
  data: string;
  inicio: string;
  fim: string;
  titulo: string;
  espacoId: string | null;
}

interface Prestador {
  id: string;
  nome: string;
  area: string;
}

interface Chamado {
  numero: number;
  nome: string;
  email: string;
  telefone: string;
  empresa: string;
  categoria: string;
  espacoId: string | null;
  assunto: string;
  descricao: string;
  status: StatusChamado;
  prestadorId: string | null;
  abertoEm: string; // ISO aaaa-mm-dd
  criadoNaSessao?: boolean;
}

interface Historico {
  id: string;
  ref: RefHistorico;
  refId: string;
  quando: string;
  autor: Autor;
  de: string | null;
  para: string;
  nota?: string;
}

interface Toast {
  id: number;
  titulo: string;
  texto: string;
}

interface Sessao {
  gestor: boolean;
  prestadorId: string | null;
}

interface Estado {
  espacos: Espaco[];
  reservas: Reserva[];
  visitas: Visita[];
  reunioes: Reuniao[];
  chamados: Chamado[];
  solicitantes: Solicitante[];
  historico: Historico[];
  sessao: Sessao;
  toasts: Toast[];
  seq: number;
  proxChamado: number;
  ultimoEmail: string;
  ultimo: { reservaId: string | null; visitaId: string | null; chamado: number | null };
}

/* ═════════════════════════════════════════════════════════════════════════════
   2 · CONSTANTES E DADOS DE EXEMPLO
   Cada constante abaixo é um ponto de ajuste (ver "Premissas e lacunas").
   ═════════════════════════════════════════════════════════════════════════════ */

/** Status de chamado do Figma. Equivalência com o briefing: Pendente = Aberto,
 *  Em Atendimento = Em andamento, Concluído = Resolvido. */
const STATUS_CHAMADO: readonly StatusChamado[] = ['Aberto', 'Em andamento', 'Resolvido', 'Fechado'];

/** false = alerta e sinalização ao Gestor; true = impede o envio (regra R4 do Guia de Estudo). */
const BLOQUEAR_CAPACIDADE = false;

/**
 * "Hoje" simulado, como no Figma (quarta, 14/10/2026).
 * Configurável pela variável de ambiente VITE_HOJE_SIMULADO (aaaa-mm-dd): sem a variável vale o padrão
 * abaixo; qualquer outro valor (por exemplo "real") usa o relógio do navegador.
 */
function lerDataSimulada(): string | null {
  const padrao = '2026-10-14';
  let bruto: string | undefined;
  try {
    bruto = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_HOJE_SIMULADO;
  } catch {
    bruto = undefined; // ambiente sem import.meta (ex.: bundle clássico)
  }
  if (bruto === undefined) return padrao;
  const v = bruto.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}
const HOJE_SIMULADO: string | null = lerDataSimulada();

/** Datas aaaa-mm-dd que não contam como dia útil na regra de antecedência da visita. Vazia = feriados ignorados. */
const FERIADOS: string[] = [];

const ANTECEDENCIA_VISITA_DIAS_UTEIS = 3;
const DURACAO_VISITA_MIN = 90;
/** grade de sugestões de horário. */
const JANELA_SUGESTOES = { inicio: '08:00', fim: '18:00', passoMin: 60, maximo: 3 };

const TIPOS_SOLICITANTE: readonly TipoSolicitante[] = ['Empreendedor', 'Residente', 'Visitante', 'Instituição'];
const TIPOS_ESPACO = ['Auditório', 'Sala de reuniões', 'Sala de mentoria', 'Laboratório', 'Coworking'];
const RECURSOS_ESPACO = ['TV 55"', 'Quadro branco', 'Videoconferência', 'Projetor', 'Som', 'Wi-Fi dedicado', 'Ar-condicionado'];
const CATEGORIAS_CHAMADO = [
  'Infraestrutura / equipamentos',
  'Internet e Wi-Fi',
  'Limpeza e conservação',
  'Acesso e segurança',
  'Outro assunto',
];
const MOTIVOS_RESERVA = [
  { rotulo: 'Capacidade insuficiente', texto: 'Capacidade insuficiente: o espaço não comporta o número de participantes informado.' },
  { rotulo: 'Horário indisponível', texto: 'Horário indisponível: já existe outra atividade programada nesta faixa.' },
  { rotulo: 'Fora do escopo', texto: 'Fora do escopo: a atividade não se enquadra nas finalidades do espaço.' },
];
const MOTIVOS_VISITA = [
  { rotulo: 'Data indisponível', texto: 'Data indisponível: a equipe não consegue receber o grupo nesta data.' },
  { rotulo: 'Capacidade do grupo', texto: 'Capacidade do grupo: o tamanho do grupo excede o que o hub consegue receber.' },
  { rotulo: 'Fora do escopo', texto: 'Fora do escopo: o objetivo da visita não se enquadra nas visitas guiadas do hub.' },
];

const PRESTADORES: Prestador[] = [
  { id: 'pr-1', nome: 'Carlos Menezes', area: 'Manutenção e infraestrutura' },
  { id: 'pr-2', nome: 'Marta Quintino', area: 'Redes e Wi-Fi' },
];

/** Contas de demonstração (premissa 11): autenticar() não é segurança de verdade. */
const CONTAS_DEMO = {
  gestor: [{ email: 'marina.costa@inpetuhub.ufsc.br', senha: 'gestor123', nome: 'Marina Costa' }],
  prestador: [
    { email: 'carlos.menezes@servicos.com.br', senha: 'prestador123', prestadorId: 'pr-1' },
    { email: 'marta.quintino@redesul.com.br', senha: 'prestador123', prestadorId: 'pr-2' },
  ],
};

/** Números fictícios do Figma (G6) por mês e por espaço; somam-se ao que acontece na sessão. */
const BASE_RELATORIOS = {
  meses: [
    { mes: '2026-07', rotulo: 'Jul/2026', reservas: 10, visitas: 3, chamados: 6, horas: 41, porEspaco: { 'esp-aud': 5, 'esp-ino': 4, 'esp-men': 1 } },
    { mes: '2026-08', rotulo: 'Ago/2026', reservas: 14, visitas: 4, chamados: 8, horas: 55, porEspaco: { 'esp-aud': 7, 'esp-ino': 5, 'esp-men': 2 } },
    { mes: '2026-09', rotulo: 'Set/2026', reservas: 17, visitas: 5, chamados: 9, horas: 68, porEspaco: { 'esp-aud': 8, 'esp-ino': 7, 'esp-men': 2 } },
    { mes: '2026-10', rotulo: 'Out/2026*', reservas: 18, visitas: 6, chamados: 11, horas: 74, porEspaco: { 'esp-aud': 9, 'esp-ino': 7, 'esp-men': 2 } },
  ] as { mes: string; rotulo: string; reservas: number; visitas: number; chamados: number; horas: number; porEspaco: Record<string, number> }[],
  confirmadasNoMesBase: 18,
};

/** Estado de partida: reproduz os exemplos do Figma (fila do Gestor, agenda, chamados). */
function criarEstadoInicial(): Estado {
  const espacos: Espaco[] = [
    {
      id: 'esp-aud', nome: 'Auditório Principal', tipo: 'Auditório', capacidade: 120,
      descricao: 'Palco, projeção e som para palestras, eventos e workshops abertos.',
      recursos: ['Projetor', 'Som', 'Videoconferência'], ativo: true, arte: 'auditorio', fotos: [],
    },
    {
      id: 'esp-ino', nome: 'Sala Inovação', tipo: 'Sala de reuniões', capacidade: 12,
      descricao: 'Sala para workshops e reuniões de equipe, com TV e videoconferência.',
      recursos: ['TV 55"', 'Quadro branco', 'Videoconferência'], ativo: true, arte: 'sala', fotos: [],
    },
    {
      id: 'esp-men', nome: 'Sala Mentoria', tipo: 'Sala de mentoria', capacidade: 8,
      descricao: 'Ambiente reservado para mentorias e reuniões com investidores.',
      recursos: ['Quadro branco', 'Wi-Fi dedicado'], ativo: true, arte: 'mentoria', fotos: [],
    },
  ];

  const solicitantes: Solicitante[] = [
    { id: 'sol-1', nome: 'Nilda Crisantemo Germach', tipo: 'Empreendedor', empresa: 'Tech Solutions', email: 'nilda@empresa.com.br', telefone: '48999990000' },
    { id: 'sol-2', nome: 'Rafael Souza', tipo: 'Residente', empresa: 'StartUp Beta', email: 'rafael@startupbeta.com', telefone: '48988881111' },
    { id: 'sol-3', nome: 'Instituição Parceira', tipo: 'Instituição', empresa: '', email: 'contato@parceira.org', telefone: '4833332222' },
    { id: 'sol-4', nome: 'Ana Lima', tipo: 'Visitante', empresa: '', email: 'ana.lima@email.com', telefone: '48977773333' },
  ];

  const reservas: Reserva[] = [
    {
      id: 'R-001', espacoId: 'esp-ino', data: '2026-11-12', inicio: '14:00', fim: '15:00',
      nome: 'Nilda Crisantemo Germach', email: 'nilda@empresa.com.br', telefone: '48999990000', empresa: 'Tech Solutions',
      tipo: 'Empreendedor', participantes: 20, finalidade: 'Palestra para os funcionários da empresa',
      status: 'Pendente', acimaCapacidade: true, criadoEm: '2026-10-13T09:40',
    },
    {
      id: 'R-002', espacoId: 'esp-aud', data: '2026-11-18', inicio: '09:00', fim: '12:00',
      nome: 'Instituição Parceira', email: 'contato@parceira.org', telefone: '4833332222', empresa: '',
      tipo: 'Instituição', participantes: 80, finalidade: 'Workshop de inovação aberta',
      status: 'Pendente', acimaCapacidade: false, criadoEm: '2026-10-13T15:05',
    },
    {
      id: 'R-003', espacoId: 'esp-men', data: '2026-11-20', inicio: '15:00', fim: '16:00',
      nome: 'Rafael Souza', email: 'rafael@startupbeta.com', telefone: '48988881111', empresa: 'StartUp Beta',
      tipo: 'Residente', participantes: 6, finalidade: 'Reunião com investidores',
      status: 'Pendente', acimaCapacidade: false, criadoEm: '2026-10-14T08:20',
    },
    {
      id: 'R-004', espacoId: 'esp-ino', data: '2026-10-21', inicio: '09:00', fim: '10:00',
      nome: 'Ana Lima', email: 'ana.lima@email.com', telefone: '48977773333', empresa: '',
      tipo: 'Visitante', participantes: 5, finalidade: 'Mentoria sobre propriedade intelectual',
      status: 'Confirmada', acimaCapacidade: false, criadoEm: '2026-10-09T10:15',
    },
  ];

  const visitas: Visita[] = [
    {
      id: 'V-001', instituicao: 'UFSC · Engenharia de Produção', email: 'engproducao@ufsc.br', telefone: '4837210000',
      data: '2026-11-16', inicio: '10:00', fim: '11:30', visitantes: 25,
      objetivo: 'Conhecer a estrutura do hub e as startups residentes', status: 'Pendente', criadoEm: '2026-10-12T11:30',
    },
    {
      id: 'V-002', instituicao: 'Escola Técnica SENAI', email: 'visitas@escola.edu.br', telefone: '4833334444',
      data: '2026-11-19', inicio: '14:00', fim: '15:30', visitantes: 15,
      objetivo: 'Visita técnica de turma de ADS', status: 'Pendente', criadoEm: '2026-10-12T16:45',
    },
    {
      id: 'V-003', instituicao: 'Prefeitura de Florianópolis', email: 'gabinete@pmf.sc.gov.br', telefone: '4832510000',
      data: '2026-11-24', inicio: '09:00', fim: '10:00', visitantes: 6,
      objetivo: 'Alinhamento sobre ações de inovação', status: 'Pendente', criadoEm: '2026-10-13T13:10',
    },
  ];

  // Reuniões internas ocupam o espaço e entram na agenda de visitas.
  const reunioes: Reuniao[] = [
    { id: 'RI-1', data: '2026-11-12', inicio: '14:00', fim: '15:00', titulo: 'Reunião interna', espacoId: 'esp-men' },
    { id: 'RI-2', data: '2026-11-17', inicio: '14:00', fim: '15:00', titulo: 'Reunião interna', espacoId: 'esp-men' },
  ];

  const chamados: Chamado[] = [
    {
      numero: 99, nome: 'Rafael Souza', email: 'rafael@startupbeta.com', telefone: '48988881111', empresa: 'StartUp Beta',
      categoria: 'Infraestrutura / equipamentos', espacoId: 'esp-men', assunto: 'Cadeira quebrada na Sala Mentoria',
      descricao: 'Uma das cadeiras perdeu o encosto durante a reunião de ontem.', status: 'Fechado', prestadorId: 'pr-1', abertoEm: '2026-09-28',
    },
    {
      numero: 100, nome: 'Instituição Parceira', email: 'contato@parceira.org', telefone: '4833332222', empresa: '',
      categoria: 'Internet e Wi-Fi', espacoId: 'esp-aud', assunto: 'Wi-Fi sem sinal no Auditório',
      descricao: 'Sem sinal de Wi-Fi na área do palco durante o evento de lançamento.', status: 'Resolvido', prestadorId: 'pr-2', abertoEm: '2026-10-01',
    },
    {
      numero: 101, nome: 'Nilda Crisantemo Germach', email: 'nilda@empresa.com.br', telefone: '48999990000', empresa: 'Tech Solutions',
      categoria: 'Infraestrutura / equipamentos', espacoId: 'esp-ino', assunto: 'Projetor da Sala Inovação não liga',
      descricao: 'O projetor não liga nem pelo controle nem pelo botão do aparelho.', status: 'Em andamento', prestadorId: 'pr-1', abertoEm: '2026-10-08',
    },
    {
      numero: 102, nome: 'Instituição Parceira', email: 'contato@parceira.org', telefone: '4833332222', empresa: '',
      categoria: 'Infraestrutura / equipamentos', espacoId: 'esp-aud', assunto: 'Ar-condicionado do Auditório com ruído',
      descricao: 'O aparelho do lado esquerdo faz um ruído alto e atrapalha as palestras.', status: 'Aberto', prestadorId: 'pr-1', abertoEm: '2026-10-09',
    },
    {
      numero: 103, nome: 'Rafael Souza', email: 'rafael@startupbeta.com', telefone: '48988881111', empresa: 'StartUp Beta',
      categoria: 'Acesso e segurança', espacoId: 'esp-men', assunto: 'Fechadura da Sala Mentoria travando',
      descricao: 'A chave gira, mas a porta só abre depois de várias tentativas.', status: 'Aberto', prestadorId: 'pr-1', abertoEm: '2026-10-12',
    },
  ];

  const h = (ref: RefHistorico, refId: string, quando: string, autor: Autor, de: string | null, para: string, nota?: string) => ({
    ref, refId, quando, autor, de, para, nota,
  });
  const rascunho: Omit<Historico, 'id'>[] = [
    ...reservas.flatMap((r) => [
      h('reserva', r.id, r.criadoEm, 'Sistema', null, 'Pendente', 'Solicitação registrada pelo solicitante.'),
      ...(r.status === 'Confirmada'
        ? [h('reserva', r.id, '2026-10-09T14:02', 'Gestor', 'Pendente', 'Confirmada', 'Reserva aprovada.')]
        : []),
    ]),
    ...visitas.map((v) => h('visita', v.id, v.criadoEm, 'Sistema', null, 'Pendente', 'Solicitação registrada pelo solicitante.')),
    ...chamados.flatMap((c) => {
      const lista = [h('chamado', String(c.numero), `${c.abertoEm}T09:10`, 'Sistema', null, 'Aberto', 'Chamado registrado pelo solicitante.')];
      if (c.prestadorId) {
        const p = PRESTADORES.find((x) => x.id === c.prestadorId);
        lista.push(h('chamado', String(c.numero), `${c.abertoEm}T10:00`, 'Gestor', 'Aberto', 'Aberto', `Encaminhado a ${p ? p.nome : 'prestador'}.`));
      }
      if (c.status !== 'Aberto') {
        lista.push(h('chamado', String(c.numero), `${somarDias(c.abertoEm, 1)}T11:20`, 'Prestador', 'Aberto', 'Em andamento', 'Atendimento iniciado.'));
      }
      if (c.status === 'Resolvido' || c.status === 'Fechado') {
        lista.push(h('chamado', String(c.numero), `${somarDias(c.abertoEm, 2)}T16:30`, 'Prestador', 'Em andamento', 'Resolvido', 'Problema resolvido no local.'));
      }
      if (c.status === 'Fechado') {
        lista.push(h('chamado', String(c.numero), `${somarDias(c.abertoEm, 3)}T09:00`, 'Gestor', 'Resolvido', 'Fechado', 'Confirmado com o solicitante.'));
      }
      return lista;
    }),
  ];
  const historico: Historico[] = rascunho.map((x, i) => ({ ...x, id: `H-${i + 1}` }));

  return {
    espacos, reservas, visitas, reunioes, chamados, solicitantes, historico,
    sessao: { gestor: false, prestadorId: null },
    toasts: [],
    seq: historico.length + 100,
    proxChamado: 104,
    ultimoEmail: 'nilda@empresa.com.br',
    ultimo: { reservaId: null, visitaId: null, chamado: null },
  };
}

/* ═════════════════════════════════════════════════════════════════════════════
   3 · REGRAS DE NEGÓCIO (funções puras, sem JSX)
   ═════════════════════════════════════════════════════════════════════════════ */

// ── Datas e horas ────────────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, '0');
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_LONGOS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

function partesISO(iso: string): [number, number, number] {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return [a, m, d];
}
function isoDe(ano: number, mes: number, dia: number): string {
  return `${ano}-${pad2(mes)}-${pad2(dia)}`;
}
function utcDe(iso: string): number {
  const [a, m, d] = partesISO(iso);
  return Date.UTC(a, m - 1, d);
}
function somarDias(iso: string, n: number): string {
  const dt = new Date(utcDe(iso) + n * 86400000);
  return isoDe(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}
/** 0 = domingo … 6 = sábado */
function diaSemana(iso: string): number {
  return new Date(utcDe(iso)).getUTCDay();
}
function segundaDa(iso: string): string {
  const dow = diaSemana(iso);
  return somarDias(iso, dow === 0 ? -6 : 1 - dow);
}
function fmtData(iso: string): string {
  const [a, m, d] = partesISO(iso);
  return `${pad2(d)}/${pad2(m)}/${a}`;
}
function fmtDataCurta(iso: string): string {
  const [, m, d] = partesISO(iso);
  return `${pad2(d)}/${pad2(m)}`;
}
function fmtDataHora(iso: string): string {
  const [d, h] = iso.split('T');
  return `${fmtData(d)} ${h ?? ''}`.trim();
}
function hoje(): string {
  if (HOJE_SIMULADO) return HOJE_SIMULADO;
  const n = new Date();
  return isoDe(n.getFullYear(), n.getMonth() + 1, n.getDate());
}
function agoraISO(): string {
  const n = new Date();
  return `${hoje()}T${pad2(n.getHours())}:${pad2(n.getMinutes())}`;
}
/** "12/11/2026" → "2026-11-12"; null se não for uma data real. */
function parseDataBR(texto: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const d = Number(m[1]);
  const mes = Number(m[2]);
  const a = Number(m[3]);
  if (a < 2000 || a > 2100 || mes < 1 || mes > 12 || d < 1) return null;
  if (d > new Date(Date.UTC(a, mes, 0)).getUTCDate()) return null;
  return isoDe(a, mes, d);
}
function mascaraData(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}
const emMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const deMin = (min: number): string => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
const somarMin = (hhmm: string, min: number): string => deMin(emMin(hhmm) + min);
const faixa = (inicio: string, fim: string) => `${inicio} – ${fim}`;
/** Lista de horários de 30 em 30 min para os seletores (24 h). */
const HORARIOS: string[] = Array.from({ length: 31 }, (_, i) => deMin(7 * 60 + i * 30)); // 07:00 … 22:00

// ── antecedência mínima da visita ──────────────────────────────────────
function ehDiaUtil(iso: string): boolean {
  const d = diaSemana(iso);
  return d !== 0 && d !== 6 && !FERIADOS.includes(iso);
}
function somarDiasUteis(iso: string, n: number): string {
  let atual = iso;
  let restante = n;
  while (restante > 0) {
    atual = somarDias(atual, 1);
    if (ehDiaUtil(atual)) restante -= 1;
  }
  return atual;
}
/** Primeira data permitida: hoje + 3 dias úteis (14/10/2026 → 19/10/2026). */
function primeiraDataVisita(base: string = hoje()): string {
  return somarDiasUteis(base, ANTECEDENCIA_VISITA_DIAS_UTEIS);
}
function antecedenciaOk(dataIso: string, base: string = hoje()): boolean {
  return dataIso >= primeiraDataVisita(base);
}

// ── validações de campo (devolvem a mensagem ou null) ───────────
const soDigitos = (v: string) => v.replace(/\D/g, '');
function validarNome(v: string): string | null {
  const n = v.trim().length;
  return n >= 3 && n <= 100 ? null : 'Informe o nome completo (3 a 100 caracteres).';
}
function validarEmail(v: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? null : 'Informe um e-mail válido, como nome@empresa.com.br.';
}
function validarTelefone(v: string): string | null {
  const n = soDigitos(v).length;
  return n === 10 || n === 11 ? null : 'Informe o telefone com DDD (10 ou 11 dígitos).';
}
function validarInteiroMin1(v: string): string | null {
  return /^\d+$/.test(v.trim()) && Number(v) >= 1 ? null : 'Informe um número inteiro maior ou igual a 1.';
}
function validarTexto10(v: string): string | null {
  return v.trim().length >= 10 ? null : 'Descreva em pelo menos 10 caracteres.';
}
function validarObrigatorio(v: string, msg: string): string | null {
  return v.trim() ? null : msg;
}
function validarDataBR(v: string): { erro: string | null; iso: string | null } {
  const iso = parseDataBR(v);
  return iso ? { erro: null, iso } : { erro: 'Informe uma data válida (dd/mm/aaaa).', iso: null };
}
function validarDataReserva(v: string): { erro: string | null; iso: string | null } {
  const r = validarDataBR(v);
  if (r.erro) return r;
  if (r.iso! < hoje()) return { erro: 'A data não pode estar no passado.', iso: null };
  return r;
}
/** fim posterior ao início e duração de 30 min a 12 h. */
function validarPeriodo(inicio: string, fim: string): string | null {
  const dur = emMin(fim) - emMin(inicio);
  if (dur <= 0) return 'O término deve ser posterior ao início.';
  if (dur < 30 || dur > 720) return 'A duração deve ficar entre 30 min e 12 h.';
  return null;
}
function formatarTelefone(v: string): string {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  const meio = d.length > 10 ? 7 : 6;
  if (d.length <= meio) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, meio)}-${d.slice(meio)}`;
}
const emailNorm = (v: string) => v.trim().toLowerCase();
const primeiraLetraMaiuscula = (v: string) => (v ? v[0].toUpperCase() + v.slice(1) : v);

// ── conflitos, disponibilidade e capacidade ─────────────
interface Bloqueio {
  origem: 'reserva' | 'reuniao';
  id: string;
  inicio: string;
  fim: string;
  rotulo: string;
  confirmado: boolean;
}
interface PeriodoEspaco {
  espacoId: string;
  data: string; // ISO
  inicio: string;
  fim: string;
}

/** [A1, A2) e [B1, B2) conflitam quando A1 < B2 e B1 < A2 (encostar não conflita). */
function sobrepoe(a1: string, a2: string, b1: string, b2: string): boolean {
  return emMin(a1) < emMin(b2) && emMin(b1) < emMin(a2);
}

function bloqueiosDoEspaco(e: Pick<Estado, 'reservas' | 'reunioes'>, espacoId: string, data: string): Bloqueio[] {
  const deReservas: Bloqueio[] = e.reservas
    .filter((r) => r.espacoId === espacoId && r.data === data && r.status !== 'Recusada')
    .map((r) => ({
      origem: 'reserva',
      id: r.id,
      inicio: r.inicio,
      fim: r.fim,
      rotulo: r.status === 'Pendente' ? 'reserva pendente' : 'reserva confirmada',
      confirmado: r.status === 'Confirmada',
    }));
  const deReunioes: Bloqueio[] = e.reunioes
    .filter((m) => m.espacoId === espacoId && m.data === data)
    .map((m) => ({ origem: 'reuniao', id: m.id, inicio: m.inicio, fim: m.fim, rotulo: m.titulo.toLowerCase(), confirmado: true }));
  return [...deReservas, ...deReunioes];
}

/** Pedido de reserva: conta Pendentes e Confirmadas. Na aprovação: só Confirmadas. */
function temConflito(
  e: Pick<Estado, 'reservas' | 'reunioes'>,
  p: PeriodoEspaco,
  opc: { ignorarId?: string; somenteConfirmados?: boolean } = {},
): Bloqueio | null {
  return (
    bloqueiosDoEspaco(e, p.espacoId, p.data).find(
      (b) => b.id !== opc.ignorarId && (!opc.somenteConfirmados || b.confirmado) && sobrepoe(p.inicio, p.fim, b.inicio, b.fim),
    ) ?? null
  );
}

/** Etiqueta Disponível / Indisponível: espaço ativo e sem bloqueio confirmado na faixa. */
function espacoDisponivel(e: Pick<Estado, 'reservas' | 'reunioes'>, esp: Espaco, p: Omit<PeriodoEspaco, 'espacoId'>): boolean {
  return esp.ativo && !temConflito(e, { espacoId: esp.id, ...p }, { somenteConfirmados: true });
}

/** até 3 horários livres de mesma duração, grade de 1 h entre 08:00 e 18:00,
 *  os mais próximos do pedido (empate vai para o mais tarde). */
function sugerirHorarios(e: Pick<Estado, 'reservas' | 'reunioes'>, p: PeriodoEspaco): { inicio: string; fim: string }[] {
  const dur = emMin(p.fim) - emMin(p.inicio);
  const { inicio: ji, fim: jf, passoMin, maximo } = JANELA_SUGESTOES;
  const alvo = emMin(p.inicio);
  const livres: number[] = [];
  for (let s = emMin(ji); s + dur <= emMin(jf); s += passoMin) {
    if (s === alvo) continue;
    if (!temConflito(e, { espacoId: p.espacoId, data: p.data, inicio: deMin(s), fim: deMin(s + dur) })) livres.push(s);
  }
  livres.sort((a, b) => Math.abs(a - alvo) - Math.abs(b - alvo) || b - a);
  return livres
    .slice(0, maximo)
    .sort((a, b) => a - b)
    .map((s) => ({ inicio: deMin(s), fim: deMin(s + dur) }));
}

/** participantes acima da capacidade do espaço. */
function acimaDaCapacidade(esp: Espaco | undefined, participantes: number): boolean {
  return !!esp && participantes > esp.capacidade;
}

/** a visita não pode sobrepor reunião interna nem visita já confirmada. */
function conflitoAgenda(e: Pick<Estado, 'reunioes' | 'visitas' | 'espacos'>, v: Visita): { item: string; inicio: string; fim: string } | null {
  const reuniao = e.reunioes.find((m) => m.data === v.data && sobrepoe(v.inicio, v.fim, m.inicio, m.fim));
  if (reuniao) {
    const esp = e.espacos.find((x) => x.id === reuniao.espacoId);
    return { item: `${reuniao.titulo.toLowerCase()}${esp ? ` na ${esp.nome}` : ''}`, inicio: reuniao.inicio, fim: reuniao.fim };
  }
  const outra = e.visitas.find((o) => o.id !== v.id && o.status === 'Confirmada' && o.data === v.data && sobrepoe(v.inicio, v.fim, o.inicio, o.fim));
  if (outra) return { item: `a visita já confirmada de ${outra.instituicao}`, inicio: outra.inicio, fim: outra.fim };
  return null;
}

// ── Agenda da semana (G4) ────────────────────────────────────────────────────
interface ItemAgenda {
  id: string;
  data: string;
  inicio: string;
  fim: string;
  titulo: string;
  tipo: 'reuniao' | 'reserva' | 'visita';
  pendente: boolean;
}
function itensDaSemana(e: Pick<Estado, 'reunioes' | 'reservas' | 'visitas' | 'espacos'>, segunda: string): ItemAgenda[] {
  const sexta = somarDias(segunda, 4);
  const dentro = (d: string) => d >= segunda && d <= sexta;
  const nomeEsp = (id: string | null) => e.espacos.find((x) => x.id === id)?.nome ?? 'Hub';
  const lista: ItemAgenda[] = [
    ...e.reunioes
      .filter((m) => dentro(m.data))
      .map((m): ItemAgenda => ({ id: m.id, data: m.data, inicio: m.inicio, fim: m.fim, titulo: `${m.titulo} · ${nomeEsp(m.espacoId)}`, tipo: 'reuniao', pendente: false })),
    ...e.reservas
      .filter((r) => r.status !== 'Recusada' && dentro(r.data))
      .map((r): ItemAgenda => ({ id: r.id, data: r.data, inicio: r.inicio, fim: r.fim, titulo: `${r.finalidade} · ${nomeEsp(r.espacoId)}`, tipo: 'reserva', pendente: r.status === 'Pendente' })),
    ...e.visitas
      .filter((v) => v.status !== 'Recusada' && dentro(v.data))
      .map((v): ItemAgenda => ({ id: v.id, data: v.data, inicio: v.inicio, fim: v.fim, titulo: `Visita: ${v.instituicao}`, tipo: 'visita', pendente: v.status === 'Pendente' })),
  ];
  return lista.sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio));
}
function tituloSemana(segunda: string): string {
  const sexta = somarDias(segunda, 4);
  const [, m1, d1] = partesISO(segunda);
  const [, m2, d2] = partesISO(sexta);
  return m1 === m2 ? `${pad2(d1)} a ${pad2(d2)}/${pad2(m2)}` : `${pad2(d1)}/${pad2(m1)} a ${pad2(d2)}/${pad2(m2)}`;
}

// ── Relatórios (G6): base fictícia + sessão ──────────────────────────────────
interface FiltroRelatorio {
  de: string; // aaaa-mm
  ate: string;
  espacoId: string; // 'todos' ou id
}
interface Relatorio {
  reservas: number;
  visitas: number;
  chamados: number;
  horas: number;
  ranking: { id: string; nome: string; total: number }[];
  meses: { mes: string; rotulo: string; reservas: number; visitas: number; chamados: number }[];
}
function calcularRelatorio(e: Pick<Estado, 'reservas' | 'visitas' | 'chamados' | 'espacos'>, f: FiltroRelatorio): Relatorio {
  const mesAtual = hoje().slice(0, 7);
  const naSessao = {
    reservas: e.reservas.filter((r) => r.confirmadaNaSessao),
    visitas: e.visitas.filter((v) => v.confirmadaNaSessao),
    chamados: e.chamados.filter((c) => c.criadoNaSessao),
  };
  const todosEspacos = f.espacoId === 'todos';
  const meses = BASE_RELATORIOS.meses.filter((m) => m.mes >= f.de && m.mes <= f.ate);

  const porEspaco: Record<string, number> = {};
  e.espacos.forEach((x) => (porEspaco[x.id] = 0));
  let horas = 0;
  let reservas = 0;
  let visitas = 0;
  let chamados = 0;
  const linhas = meses.map((m) => {
    const somaEsp = Object.values(m.porEspaco).reduce((a, b) => a + b, 0) || 1;
    Object.entries(m.porEspaco).forEach(([id, n]) => {
      porEspaco[id] = (porEspaco[id] ?? 0) + n;
    });
    const nRes = todosEspacos ? m.reservas : m.porEspaco[f.espacoId] ?? 0;
    horas += todosEspacos ? m.horas : (m.horas * (m.porEspaco[f.espacoId] ?? 0)) / somaEsp;
    reservas += nRes;
    visitas += m.visitas;
    chamados += m.chamados;
    let extraRes = 0;
    let extraVis = 0;
    let extraCha = 0;
    if (m.mes === mesAtual) {
      naSessao.reservas.forEach((r) => {
        porEspaco[r.espacoId] = (porEspaco[r.espacoId] ?? 0) + 1;
        if (todosEspacos || r.espacoId === f.espacoId) {
          extraRes += 1;
          horas += (emMin(r.fim) - emMin(r.inicio)) / 60;
        }
      });
      extraVis = naSessao.visitas.length;
      extraCha = naSessao.chamados.length;
      reservas += extraRes;
      visitas += extraVis;
      chamados += extraCha;
    }
    return { mes: m.mes, rotulo: m.rotulo, reservas: nRes + extraRes, visitas: m.visitas + extraVis, chamados: m.chamados + extraCha };
  });

  const ranking = e.espacos
    .map((x) => ({ id: x.id, nome: x.nome, total: porEspaco[x.id] ?? 0 }))
    .filter((x) => todosEspacos || x.id === f.espacoId)
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
  return { reservas, visitas, chamados, horas: Math.round(horas * 10) / 10, ranking, meses: linhas };
}
const fmtHoras = (h: number) => (Number.isInteger(h) ? `${h} h` : `${String(h).replace('.', ',')} h`);

/** Indicadores da Fila (G2): "Confirmadas no mês" soma a base do Figma às aprovações da sessão. */
function confirmadasNoMes(e: Pick<Estado, 'reservas'>): number {
  return BASE_RELATORIOS.confirmadasNoMesBase + e.reservas.filter((r) => r.confirmadaNaSessao).length;
}

// ── Seletores e utilitários de apresentação ─────────────────────────────────
const nomeDoEspaco = (e: Pick<Estado, 'espacos'>, id: string | null): string => e.espacos.find((x) => x.id === id)?.nome ?? '—';
const nomeDoPrestador = (id: string | null): string => PRESTADORES.find((p) => p.id === id)?.nome ?? 'Sem prestador';
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const empresaOuVisitante = (empresa: string) => empresa || 'Visitante';

function tomDoStatus(status: string): Tom {
  switch (status) {
    case 'Confirmada':
    case 'Resolvido':
    case 'Disponível':
      return 'ok';
    case 'Pendente':
    case 'Aberto':
      return 'aviso';
    case 'Recusada':
    case 'Indisponível':
      return 'erro';
    case 'Em andamento':
      return 'info';
    default:
      return 'neutro';
  }
}

/** autenticar(): troque por uma chamada de API real (premissa 11). */
function autenticar(
  perfil: 'gestor' | 'prestador',
  email: string,
  senha: string,
): { ok: true; prestadorId: string | null; nome: string } | { ok: false } {
  const mail = emailNorm(email);
  if (perfil === 'gestor') {
    const c = CONTAS_DEMO.gestor.find((x) => x.email === mail && x.senha === senha);
    return c ? { ok: true, prestadorId: null, nome: c.nome } : { ok: false };
  }
  const c = CONTAS_DEMO.prestador.find((x) => x.email === mail && x.senha === senha);
  if (!c) return { ok: false };
  const p = PRESTADORES.find((x) => x.id === c.prestadorId);
  return { ok: true, prestadorId: c.prestadorId, nome: p ? p.nome : 'Prestador' };
}


/* ═════════════════════════════════════════════════════════════════════════════
   4 · ESTADO GLOBAL (useReducer)
   Toda mudança de status grava histórico e simula o e-mail ao solicitante
. notificar() é só um aviso na tela — troque por uma API real.
   ═════════════════════════════════════════════════════════════════════════════ */

type NovaReserva = Omit<Reserva, 'id' | 'status' | 'acimaCapacidade' | 'criadoEm' | 'confirmadaNaSessao' | 'motivoRecusa'>;
type NovaVisita = Omit<Visita, 'id' | 'fim' | 'status' | 'criadoEm' | 'confirmadaNaSessao' | 'motivoRecusa'>;
type NovoChamado = Omit<Chamado, 'numero' | 'status' | 'prestadorId' | 'abertoEm' | 'criadoNaSessao'>;
type EspacoForm = Omit<Espaco, 'id'> & { id?: string };
type SolicitanteForm = Omit<Solicitante, 'id'> & { id?: string };

type Acao =
  | { tipo: 'reserva/criar'; dados: NovaReserva }
  | { tipo: 'reserva/decidir'; id: string; decisao: 'Confirmada' | 'Recusada'; motivo?: string }
  | { tipo: 'visita/criar'; dados: NovaVisita }
  | { tipo: 'visita/decidir'; id: string; decisao: 'Confirmada' | 'Recusada'; motivo?: string }
  | { tipo: 'chamado/criar'; dados: NovoChamado }
  | { tipo: 'chamado/encaminhar'; numero: number; prestadorId: string }
  | { tipo: 'chamado/status'; numero: number; status: StatusChamado; nota: string; autor: 'Gestor' | 'Prestador' }
  | { tipo: 'espaco/salvar'; espaco: EspacoForm }
  | { tipo: 'espaco/ativo'; id: string; ativo: boolean }
  | { tipo: 'solicitante/salvar'; dados: SolicitanteForm }
  | { tipo: 'sessao/entrar'; perfil: 'gestor' | 'prestador'; prestadorId?: string | null }
  | { tipo: 'sessao/sair'; perfil: 'gestor' | 'prestador' }
  | { tipo: 'toast/fechar'; id: number }
  | { tipo: 'ultimoEmail'; email: string };

function proximoId(ids: string[], prefixo: string): string {
  const max = ids.reduce((m, id) => Math.max(m, Number(id.split('-')[1]) || 0), 0);
  return `${prefixo}-${String(max + 1).padStart(3, '0')}`;
}

/** Acrescenta uma linha ao histórico e, se houver destinatário, um aviso de e-mail simulado. */
function registrar(
  e: Estado,
  item: Omit<Historico, 'id' | 'quando'>,
  email?: { para: string; texto: string },
): Estado {
  const seq = e.seq + 1;
  const historico: Historico[] = [...e.historico, { ...item, id: `H-${seq}`, quando: agoraISO() }];
  const toasts = email
    ? [...e.toasts, { id: seq, titulo: 'E-mail enviado (simulado)', texto: `${email.texto} Destinatário: ${email.para}.` }].slice(-3)
    : e.toasts;
  return { ...e, seq, historico, toasts };
}

function reducer(e: Estado, a: Acao): Estado {
  switch (a.tipo) {
    case 'reserva/criar': {
      const esp = e.espacos.find((x) => x.id === a.dados.espacoId);
      const id = proximoId(e.reservas.map((r) => r.id), 'R');
      const reserva: Reserva = {
        ...a.dados,
        email: emailNorm(a.dados.email),
        telefone: soDigitos(a.dados.telefone),
        id,
        status: 'Pendente',
        acimaCapacidade: acimaDaCapacidade(esp, a.dados.participantes),
        criadoEm: agoraISO(),
      };
      const conhecido = e.solicitantes.some((s) => s.email === reserva.email);
      const solicitantes = conhecido
        ? e.solicitantes
        : [
            ...e.solicitantes,
            {
              id: proximoId(e.solicitantes.map((s) => s.id), 'sol'),
              nome: reserva.nome,
              tipo: reserva.tipo,
              empresa: reserva.empresa,
              email: reserva.email,
              telefone: reserva.telefone,
            },
          ];
      const base: Estado = {
        ...e,
        reservas: [...e.reservas, reserva],
        solicitantes,
        ultimoEmail: reserva.email,
        ultimo: { ...e.ultimo, reservaId: id },
      };
      return registrar(
        base,
        { ref: 'reserva', refId: id, autor: 'Sistema', de: null, para: 'Pendente', nota: 'Solicitação registrada pelo solicitante.' },
        { para: reserva.email, texto: 'Confirmação de recebimento da solicitação.' },
      );
    }

    case 'reserva/decidir': {
      const r = e.reservas.find((x) => x.id === a.id);
      if (!r) return e;
      const atualizada: Reserva = {
        ...r,
        status: a.decisao,
        motivoRecusa: a.decisao === 'Recusada' ? a.motivo : undefined,
        confirmadaNaSessao: a.decisao === 'Confirmada' ? true : r.confirmadaNaSessao,
      };
      const base = { ...e, reservas: e.reservas.map((x) => (x.id === a.id ? atualizada : x)) };
      return registrar(
        base,
        { ref: 'reserva', refId: r.id, autor: 'Gestor', de: r.status, para: a.decisao, nota: a.decisao === 'Recusada' ? a.motivo : 'Reserva aprovada.' },
        { para: r.email, texto: a.decisao === 'Confirmada' ? 'Reserva confirmada.' : 'Reserva recusada, com a justificativa.' },
      );
    }

    case 'visita/criar': {
      const id = proximoId(e.visitas.map((v) => v.id), 'V');
      const visita: Visita = {
        ...a.dados,
        email: emailNorm(a.dados.email),
        telefone: soDigitos(a.dados.telefone),
        id,
        fim: somarMin(a.dados.inicio, DURACAO_VISITA_MIN),
        status: 'Pendente',
        criadoEm: agoraISO(),
      };
      const base: Estado = { ...e, visitas: [...e.visitas, visita], ultimoEmail: visita.email, ultimo: { ...e.ultimo, visitaId: id } };
      return registrar(
        base,
        { ref: 'visita', refId: id, autor: 'Sistema', de: null, para: 'Pendente', nota: 'Solicitação registrada pelo solicitante.' },
        { para: visita.email, texto: 'Confirmação de recebimento do pedido de visita.' },
      );
    }

    case 'visita/decidir': {
      const v = e.visitas.find((x) => x.id === a.id);
      if (!v) return e;
      const atualizada: Visita = {
        ...v,
        status: a.decisao,
        motivoRecusa: a.decisao === 'Recusada' ? a.motivo : undefined,
        confirmadaNaSessao: a.decisao === 'Confirmada' ? true : v.confirmadaNaSessao,
      };
      const base = { ...e, visitas: e.visitas.map((x) => (x.id === a.id ? atualizada : x)) };
      return registrar(
        base,
        { ref: 'visita', refId: v.id, autor: 'Gestor', de: v.status, para: a.decisao, nota: a.decisao === 'Recusada' ? a.motivo : 'Visita aprovada e adicionada à agenda.' },
        { para: v.email, texto: a.decisao === 'Confirmada' ? 'Visita aprovada.' : 'Visita recusada, com a justificativa.' },
      );
    }

    case 'chamado/criar': {
      const numero = e.proxChamado;
      const chamado: Chamado = {
        ...a.dados,
        email: emailNorm(a.dados.email),
        telefone: soDigitos(a.dados.telefone),
        numero,
        status: 'Aberto',
        prestadorId: null,
        abertoEm: hoje(),
        criadoNaSessao: true,
      };
      const base: Estado = {
        ...e,
        chamados: [...e.chamados, chamado],
        proxChamado: numero + 1,
        ultimoEmail: chamado.email,
        ultimo: { ...e.ultimo, chamado: numero },
      };
      return registrar(
        base,
        { ref: 'chamado', refId: String(numero), autor: 'Sistema', de: null, para: 'Aberto', nota: 'Chamado registrado pelo solicitante.' },
        { para: chamado.email, texto: `Número do chamado: #${numero}.` },
      );
    }

    case 'chamado/encaminhar': {
      const c = e.chamados.find((x) => x.numero === a.numero);
      if (!c) return e;
      const base = { ...e, chamados: e.chamados.map((x) => (x.numero === a.numero ? { ...x, prestadorId: a.prestadorId } : x)) };
      return registrar(base, {
        ref: 'chamado',
        refId: String(c.numero),
        autor: 'Gestor',
        de: c.status,
        para: c.status,
        nota: `Encaminhado a ${nomeDoPrestador(a.prestadorId)}.`,
      });
    }

    case 'chamado/status': {
      const c = e.chamados.find((x) => x.numero === a.numero);
      if (!c) return e;
      const base = { ...e, chamados: e.chamados.map((x) => (x.numero === a.numero ? { ...x, status: a.status } : x)) };
      return registrar(
        base,
        { ref: 'chamado', refId: String(c.numero), autor: a.autor, de: c.status, para: a.status, nota: a.nota || undefined },
        { para: c.email, texto: `Chamado #${c.numero} agora está "${a.status}".` },
      );
    }

    case 'espaco/salvar': {
      const { id, ...resto } = a.espaco;
      if (id) return { ...e, espacos: e.espacos.map((x) => (x.id === id ? { ...x, ...resto } : x)) };
      const novo: Espaco = { ...resto, id: proximoId(e.espacos.map((x) => x.id), 'esp') };
      return { ...e, espacos: [...e.espacos, novo] };
    }

    case 'espaco/ativo':
      return { ...e, espacos: e.espacos.map((x) => (x.id === a.id ? { ...x, ativo: a.ativo } : x)) };

    case 'solicitante/salvar': {
      const { id, ...resto } = a.dados;
      const limpo = { ...resto, email: emailNorm(resto.email), telefone: soDigitos(resto.telefone) };
      if (id) return { ...e, solicitantes: e.solicitantes.map((x) => (x.id === id ? { ...x, ...limpo } : x)) };
      return { ...e, solicitantes: [...e.solicitantes, { ...limpo, id: proximoId(e.solicitantes.map((x) => x.id), 'sol') }] };
    }

    case 'sessao/entrar':
      return a.perfil === 'gestor'
        ? { ...e, sessao: { ...e.sessao, gestor: true } }
        : { ...e, sessao: { ...e.sessao, prestadorId: a.prestadorId ?? null } };

    case 'sessao/sair':
      return a.perfil === 'gestor' ? { ...e, sessao: { ...e.sessao, gestor: false } } : { ...e, sessao: { ...e.sessao, prestadorId: null } };

    case 'toast/fechar':
      return { ...e, toasts: e.toasts.filter((t) => t.id !== a.id) };

    case 'ultimoEmail':
      return { ...e, ultimoEmail: emailNorm(a.email) };

    default:
      return e;
  }
}

interface Loja {
  estado: Estado;
  despachar: (a: Acao) => void;
}
const LojaCtx = createContext<Loja | null>(null);
function useLoja(): Loja {
  const l = useContext(LojaCtx);
  if (!l) throw new Error('LojaCtx ausente: envolva a árvore em <LojaCtx.Provider>.');
  return l;
}

/** Aviso temporário de 4 s para ações. */
function useAvisoTemporario<T>(ms: number = 4000): [T | null, (v: T | null) => void] {
  const [valor, setValor] = useState<T | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const definir = useCallback(
    (v: T | null) => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
      setValor(v);
      if (v !== null) timer.current = window.setTimeout(() => setValor(null), ms);
    },
    [ms],
  );
  useEffect(
    () => () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    },
    [],
  );
  return [valor, definir];
}


/* ═════════════════════════════════════════════════════════════════════════════
   5 · COMPONENTES DE UI — espelham a página "Components" do Figma
   (Botão/Primário, Botão/Secundário, Campo, Tag, Card Espaço, Header…).
   Layout e tipografia usam utilitários básicos do Tailwind; as cores e medidas
   exatas do Figma ficam em ESTILOS (variáveis CSS), para o arquivo funcionar
   mesmo onde o Tailwind não compila valores arbitrários.
   ═════════════════════════════════════════════════════════════════════════════ */

const ESTILOS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
.ip-root{--ip-primary:#2563eb;--ip-primary-dark:#1d4ed8;--ip-soft:#eef3ff;--ip-ink:#0f1b2e;--ip-muted:#56657a;--ip-line:#e2e8f0;--ip-bg:#f6f8fc;--ip-ph:#e8eef7;
--ip-sh1:0 1px 2px rgba(15,27,46,.05),0 1px 3px rgba(15,27,46,.04);--ip-sh2:0 2px 4px rgba(15,27,46,.04),0 12px 32px -10px rgba(15,27,46,.14);
--ip-ok:#1e8e5a;--ip-ok-ink:#16754b;--ip-ok-bg:#e6f6ee;--ip-ok-bd:#b9e3cd;
--ip-warn:#8a5a00;--ip-warn-bg:#fff4db;--ip-warn-bd:#f1d89b;
--ip-bad:#b3261e;--ip-bad-bg:#fdecea;--ip-bad-bd:#f0bcb7;--ip-info-bd:#c7d7fb;--g:16px;
font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
color:var(--ip-ink);background:var(--ip-bg);font-size:15px;line-height:1.6;min-height:100vh;display:flex;flex-direction:column;-webkit-font-smoothing:antialiased}
.ip-root>main{flex:1 0 auto}
@media(min-width:768px){.ip-root{--g:32px}}
@media(min-width:1024px){.ip-root{--g:48px}}
.ip-root *,.ip-root *::before,.ip-root *::after{box-sizing:border-box}
.ip-root button,.ip-root input,.ip-root select,.ip-root textarea{font-family:inherit}
.ip-root :focus-visible{outline:2px solid var(--ip-primary);outline-offset:2px}
.ip-root h1[tabindex="-1"]:focus{outline:none}
.ip-gutter{padding-left:max(var(--g),env(safe-area-inset-left,0px));padding-right:max(var(--g),env(safe-area-inset-right,0px))}
.ip-wrap{width:100%;max-width:1344px;margin-left:auto;margin-right:auto}
.ip-aside{width:100%}
@media(min-width:1024px){.ip-aside{width:360px;flex:none}}
.ip-cols{display:flex;flex-direction:column;gap:24px}
@media(min-width:1024px){.ip-cols{flex-direction:row;gap:32px;align-items:flex-start}.ip-cols>.ip-main{flex:1;min-width:0}}

/* cores (Figma) */
.text-ip-ink{color:var(--ip-ink)}.text-ip-muted{color:var(--ip-muted)}.text-ip-primary{color:var(--ip-primary-dark)}
.text-ip-ok{color:var(--ip-ok-ink)}.text-ip-warn{color:var(--ip-warn)}.text-ip-bad{color:var(--ip-bad)}
.bg-ip-primary{background-color:var(--ip-primary)}.bg-ip-soft{background-color:var(--ip-soft)}.bg-ip-bg{background-color:var(--ip-bg)}
.bg-ip-ink{background-color:var(--ip-ink)}.bg-ip-warn-bg{background-color:var(--ip-warn-bg)}.bg-ip-bad-bg{background-color:var(--ip-bad-bg)}
.border-ip-line{border-color:var(--ip-line)}.border-ip-bad{border-color:var(--ip-bad-bd)}.border-ip-warn{border-color:var(--ip-warn-bd)}

/* tipografia */
.ip-h1{font-size:32px;line-height:1.15;font-weight:800;letter-spacing:-.025em;margin:0}
.ip-h2{font-size:18px;line-height:1.35;font-weight:700;letter-spacing:-.01em;margin:0}
.ip-h2-lg{font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-.02em;margin:0}
.ip-hero{font-size:clamp(32px,5.6vw,52px);line-height:1.08;font-weight:800;letter-spacing:-.035em;margin:0}
.ip-t13{font-size:13px;line-height:1.45}
.ip-sec{font-size:24px;line-height:1.3;font-weight:700;letter-spacing:-.02em;margin:0}
@media(max-width:639px){.ip-h1{font-size:26px}.ip-sec{font-size:21px}}

/* botões */
.ip-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:10px 22px;border-radius:12px;border:1px solid transparent;
font-size:14px;line-height:20px;font-weight:600;cursor:pointer;white-space:nowrap;text-decoration:none;transition:background-color .15s,border-color .15s,color .15s,box-shadow .15s,transform .15s}
.ip-btn:active:not(:disabled){transform:translateY(1px)}
.ip-btn:disabled{opacity:.4;cursor:not-allowed}
.ip-btn-sm{min-height:40px;padding:8px 16px;border-radius:10px}
.ip-btn-primary{background:var(--ip-primary);color:#fff;box-shadow:0 1px 2px rgba(29,78,216,.35),0 6px 14px -6px rgba(37,99,235,.55)}
.ip-btn-primary:hover:not(:disabled){background:var(--ip-primary-dark);box-shadow:0 1px 2px rgba(29,78,216,.4),0 10px 20px -8px rgba(37,99,235,.6)}
.ip-btn-secondary{background:#fff;color:var(--ip-ink);border-color:#d5dce8;box-shadow:var(--ip-sh1)}
.ip-btn-secondary:hover:not(:disabled){background:var(--ip-bg);border-color:#b8c3d4}
.ip-btn-danger{background:var(--ip-bad);color:#fff;box-shadow:0 6px 14px -6px rgba(179,38,30,.5)}
.ip-btn-danger:hover:not(:disabled){background:#8f1d17}
.ip-btn-ghost{background:transparent;color:var(--ip-primary-dark);padding-left:10px;padding-right:10px}
.ip-btn-ghost:hover:not(:disabled){background:var(--ip-soft)}
.ip-iconbtn{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;flex:none;border:0;border-radius:10px;background:transparent;color:inherit;cursor:pointer}
.ip-iconbtn:hover{background:rgba(18,38,63,.08)}
.ip-spin{width:16px;height:16px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:ip-rot .7s linear infinite}
@keyframes ip-rot{to{transform:rotate(360deg)}}

/* campos */
.ip-input{display:block;width:100%;min-height:46px;padding:12px 14px;border:1px solid #d5dce8;border-radius:12px;box-shadow:var(--ip-sh1);transition:border-color .15s,box-shadow .15s;background:#fff;color:var(--ip-ink);font-size:14px;line-height:20px}
.ip-input::placeholder{color:#667587}
.ip-input:hover:not(:disabled){border-color:#b8c3d4}
.ip-input:focus{border-color:var(--ip-primary);outline:2px solid rgba(37,99,235,.28);outline-offset:0;box-shadow:0 0 0 4px rgba(37,99,235,.10)}
.ip-input[aria-invalid="true"]{border-color:var(--ip-bad);background:#fffafa}
.ip-input:disabled{background:var(--ip-bg);color:var(--ip-muted)}
textarea.ip-input{min-height:96px;resize:vertical}
select.ip-input{appearance:none;-webkit-appearance:none;padding-right:38px;background-repeat:no-repeat;background-position:right 12px center;
background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235b6b7f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")}

/* tags e alertas */
.ip-tag{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:999px;font-size:12px;line-height:16px;font-weight:600;white-space:nowrap}
.ip-tag-ok{background:var(--ip-ok-bg);color:var(--ip-ok-ink)}
.ip-tag-aviso{background:var(--ip-warn-bg);color:var(--ip-warn)}
.ip-tag-erro{background:var(--ip-bad-bg);color:var(--ip-bad)}
.ip-tag-info{background:var(--ip-soft);color:var(--ip-primary-dark)}
.ip-tag-neutro{background:#eceff3;color:var(--ip-muted)}
.ip-alert{display:flex;align-items:flex-start;gap:12px;padding:16px 20px;border-radius:14px;border:1px solid}
.ip-alert-ok{background:var(--ip-ok-bg);border-color:var(--ip-ok-bd);color:var(--ip-ok-ink)}
.ip-alert-aviso{background:var(--ip-warn-bg);border-color:var(--ip-warn-bd);color:var(--ip-warn)}
.ip-alert-erro{background:var(--ip-bad-bg);border-color:var(--ip-bad-bd);color:var(--ip-bad)}
.ip-alert-info{background:var(--ip-soft);border-color:var(--ip-info-bd);color:var(--ip-primary-dark)}

/* cartões, chips, passos */
.ip-card{background:#fff;border:1px solid var(--ip-line);border-radius:16px;box-shadow:var(--ip-sh1)}
.ip-card-lg{border-radius:20px;box-shadow:var(--ip-sh2);transition:box-shadow .2s,transform .2s}
@media(hover:hover){.ip-card-lg:hover{transform:translateY(-2px);box-shadow:0 2px 4px rgba(15,27,46,.04),0 18px 40px -12px rgba(15,27,46,.18)}}
.ip-card-destaque{border-color:var(--ip-primary);box-shadow:0 0 0 1px var(--ip-primary),var(--ip-sh2)}
.ip-shadow{box-shadow:0 24px 60px -12px rgba(15,27,46,.28)}
.ip-chip{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:8px 14px;border-radius:999px;border:1px solid #d5dce8;background:#fff;
color:var(--ip-muted);font-size:13px;line-height:18px;font-weight:500;cursor:pointer;transition:background-color .15s,border-color .15s}
.ip-chip:hover{border-color:#b8c3d4;background:var(--ip-bg)}
.ip-chip[aria-pressed="true"]{background:var(--ip-soft);border-color:var(--ip-primary);color:var(--ip-primary-dark);font-weight:600}
.ip-step{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex:none;border-radius:50%;background:var(--ip-line);color:var(--ip-ink);font-size:13px;font-weight:700}
.ip-step-on{background:var(--ip-primary);color:#fff}
.ip-step-line{display:inline-block;width:40px;height:2px;background:var(--ip-line)}
@media(max-width:639px){.ip-step-line{width:16px}}
.ip-foto{width:100%;height:140px;border-radius:12px;overflow:hidden;background:var(--ip-ph);flex:none}
@media(min-width:640px){.ip-foto{width:200px}}
.ip-logo{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:11px;background:#2563eb linear-gradient(135deg,#2563eb,#1e40af);color:#fff;font-size:18px;font-weight:800;box-shadow:0 6px 14px -6px rgba(37,99,235,.6)}
.ip-switch{position:relative;width:44px;height:24px;flex:none;padding:0;border:0;border-radius:999px;background:#9aa7b6;cursor:pointer;transition:background-color .15s}
.ip-switch[aria-checked="true"]{background:var(--ip-primary)}
.ip-switch-knob{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .15s}
.ip-switch[aria-checked="true"] .ip-switch-knob{transform:translateX(20px)}
.ip-hist{border-left:3px solid var(--ip-line);padding-left:12px}
.ip-check{display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:var(--ip-ok);color:#fff}
.ip-icone{display:flex;align-items:center;justify-content:center;width:48px;height:48px;flex:none;border-radius:14px;background:var(--ip-soft);color:var(--ip-primary-dark)}
.ip-caixa{background:var(--ip-bg);border-radius:14px;padding:16px}
.ip-dropzone{display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px;border:1.5px dashed #b8c3d4;border-radius:14px;background:var(--ip-bg);text-align:center}
.ip-bar{height:14px;border-radius:0 4px 4px 0;background:var(--ip-primary);min-width:4px}
.ip-bar-trilho{height:14px;border-radius:0 4px 4px 0;background:#e3e8ef;flex:1;min-width:0}
.ip-sob-rotulo{display:flex;flex-direction:column}
@media(min-width:640px){.ip-sob-rotulo{padding-top:24px}}
.ip-agenda{border-left:4px solid var(--ip-line);background:#fff;border-radius:10px;border-top:1px solid var(--ip-line);border-right:1px solid var(--ip-line);border-bottom:1px solid var(--ip-line);padding:10px 12px}
.ip-agenda-reuniao{border-left-color:#8896a8}
.ip-agenda-reserva{border-left-color:var(--ip-primary)}
.ip-agenda-visita{border-left-color:var(--ip-ok)}
.ip-agenda-pendente{background:var(--ip-warn-bg);border-left-color:#d9a21b}

/* cabeçalho global */
.ip-header{position:relative;z-index:40}
@media(min-width:768px){.ip-header{position:sticky;top:env(safe-area-inset-top,0px)}}
.ip-header-bar{background:rgba(255,255,255,.9);-webkit-backdrop-filter:saturate(180%) blur(14px);backdrop-filter:saturate(180%) blur(14px);border-bottom:1px solid var(--ip-line);box-shadow:var(--ip-sh1)}
.ip-header-main{min-height:76px}
.ip-footer{margin-top:48px;background:#fff;border-top:1px solid var(--ip-line)}
.ip-hero-sec{background:radial-gradient(900px 360px at 85% -10%,rgba(37,99,235,.14),transparent 70%),linear-gradient(180deg,#eef3ff 0%,var(--ip-bg) 100%)}
.ip-skip{position:absolute;left:16px;top:-100px;z-index:80;padding:10px 16px;border-radius:10px;border:2px solid var(--ip-primary);background:#fff;color:var(--ip-ink);font-size:14px;font-weight:600;cursor:pointer}
.ip-skip:focus{top:8px}
.ip-root main[tabindex="-1"]:focus{outline:none}

/* navegação */
.ip-nav{display:flex;align-items:center;gap:4px;overflow-x:auto;scrollbar-width:thin}
.ip-nav button.ip-nav-item{min-height:40px;padding:8px 14px;border:0;border-radius:10px;background:transparent;color:var(--ip-muted);font-size:14px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background-color .15s,color .15s}
.ip-nav button.ip-nav-item:hover{color:var(--ip-ink);background:var(--ip-bg)}
.ip-nav button.ip-nav-item[aria-current="page"]{color:var(--ip-primary-dark);background:var(--ip-soft);font-weight:600}

/* modal e avisos */
.ip-overlay{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;overflow-y:auto;background:rgba(15,27,46,.55);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);
padding:max(16px,env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) max(16px,env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px))}
.ip-modal{width:100%;max-height:100%;overflow-y:auto;background:#fff;border-radius:20px;padding:24px;box-shadow:0 24px 64px -12px rgba(15,27,46,.4)}
@media(min-width:640px){.ip-modal{padding:32px}}
.ip-toasts{position:fixed;z-index:70;display:flex;flex-direction:column;gap:8px;pointer-events:none;
right:max(16px,env(safe-area-inset-right,0px));bottom:max(16px,env(safe-area-inset-bottom,0px));left:max(16px,env(safe-area-inset-left,0px))}
@media(min-width:640px){.ip-toasts{left:auto;width:380px}}
.ip-toast{display:flex;align-items:flex-start;gap:10px;padding:14px 10px 14px 16px;border-radius:14px;background:var(--ip-ink);color:#fff;pointer-events:auto;box-shadow:0 16px 40px -8px rgba(15,27,46,.45);animation:ip-in .2s ease-out}
.ip-toast .ip-iconbtn{width:32px;height:32px;color:#fff}
@keyframes ip-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.ip-root *{transition:none!important;animation-duration:.01ms!important}}
`;

// ── Ícones de estado desenhados à mão (independem da versão do lucide-react) ──
function Svg({ children, tamanho = 18, className = '' }: { children: React.ReactNode; tamanho?: number; className?: string }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

function IconeTom({ tom, tamanho = 20 }: { tom: Tom; tamanho?: number }) {
  if (tom === 'ok')
    return (
      <Svg tamanho={tamanho}>
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
      </Svg>
    );
  if (tom === 'aviso')
    return (
      <Svg tamanho={tamanho}>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </Svg>
    );
  if (tom === 'erro')
    return (
      <Svg tamanho={tamanho}>
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6" />
        <path d="m9 9 6 6" />
      </Svg>
    );
  return (
    <Svg tamanho={tamanho}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </Svg>
  );
}

// ── Botão (Primário / Secundário) ────────────────────────────────────────────
const VARIANTE_BOTAO = { primario: 'ip-btn-primary', secundario: 'ip-btn-secondary', perigo: 'ip-btn-danger', fantasma: 'ip-btn-ghost' };
interface BotaoProps {
  variante?: 'primario' | 'secundario' | 'perigo' | 'fantasma';
  carregando?: boolean;
  textoCarregando?: string;
  desabilitado?: boolean;
  pequeno?: boolean;
  bloco?: boolean;
  tipo?: 'button' | 'submit';
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  id?: string;
  ariaLabel?: string;
  titulo?: string;
}
function Botao(p: BotaoProps) {
  const { variante = 'primario', carregando = false, desabilitado = false, pequeno = false, bloco = false, tipo = 'button' } = p;
  return (
    <button
      type={tipo}
      id={p.id}
      title={p.titulo}
      aria-label={p.ariaLabel}
      aria-busy={carregando || undefined}
      disabled={desabilitado || carregando}
      onClick={p.onClick}
      className={`ip-btn ${VARIANTE_BOTAO[variante]} ${pequeno ? 'ip-btn-sm' : ''} ${bloco ? 'w-full' : ''} ${p.className ?? ''}`}
    >
      {carregando && <span className="ip-spin" aria-hidden="true" />}
      {carregando ? p.textoCarregando ?? 'Enviando…' : p.children}
    </button>
  );
}

// ── Tag (Disponível, Pendente, Indisponível…) ────────────────────────────────
function Tag({ tom, children }: { tom: Tom; children: React.ReactNode }) {
  return <span className={`ip-tag ip-tag-${tom}`}>{children}</span>;
}
function TagStatus({ status }: { status: string }) {
  return <Tag tom={tomDoStatus(status)}>{status}</Tag>;
}

// ── Alerta ───────────────────────────────────────────────────────────────────
function Alerta({
  tom,
  titulo,
  children,
  onFechar,
  className = '',
}: {
  tom: Tom;
  titulo?: string;
  children?: React.ReactNode;
  onFechar?: () => void;
  className?: string;
}) {
  const classe = tom === 'neutro' ? 'info' : tom;
  return (
    <div role={tom === 'erro' ? 'alert' : 'status'} className={`ip-alert ip-alert-${classe} ${className}`}>
      <span className="mt-0.5 shrink-0">
        <IconeTom tom={tom} />
      </span>
      <div className="min-w-0 flex-1">
        {titulo && <p className="text-sm font-semibold">{titulo}</p>}
        {children ? <div className={`ip-t13 ${titulo ? 'mt-1' : ''}`}>{children}</div> : null}
      </div>
      {onFechar && (
        <button type="button" className="ip-iconbtn -mr-2 -mt-2" onClick={onFechar} aria-label="Fechar aviso">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

// ── Campo (rótulo acima, erro abaixo) ────────────────────────────────────────
interface CampoBaseProps {
  id: string;
  rotulo: string;
  erro?: string | null;
  dica?: string;
  className?: string;
}
function descrito(id: string, erro?: string | null, dica?: string): string | undefined {
  return erro ? `${id}-erro` : dica ? `${id}-dica` : undefined;
}
function CampoCaixa({ id, rotulo, erro, dica, className = '', children }: CampoBaseProps & { children: React.ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-xs font-medium text-ip-muted">
        {rotulo}
      </label>
      {children}
      {erro ? (
        <p id={`${id}-erro`} className="text-xs font-medium text-ip-bad">
          {erro}
        </p>
      ) : dica ? (
        <p id={`${id}-dica`} className="text-xs text-ip-muted">
          {dica}
        </p>
      ) : null}
    </div>
  );
}

interface CampoTextoProps extends CampoBaseProps {
  valor: string;
  onMudar: (v: string) => void;
  tipo?: string;
  placeholder?: string;
  mascara?: (v: string) => string;
  maxLength?: number;
  autoComplete?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'decimal' | 'search' | 'url' | 'none';
  desabilitado?: boolean;
}
function CampoTexto(p: CampoTextoProps) {
  return (
    <CampoCaixa id={p.id} rotulo={p.rotulo} erro={p.erro} dica={p.dica} className={p.className}>
      <input
        id={p.id}
        name={p.id}
        type={p.tipo ?? 'text'}
        value={p.valor}
        placeholder={p.placeholder}
        maxLength={p.maxLength}
        autoComplete={p.autoComplete ?? 'off'}
        inputMode={p.inputMode}
        disabled={p.desabilitado}
        aria-invalid={p.erro ? true : undefined}
        aria-describedby={descrito(p.id, p.erro, p.dica)}
        className="ip-input"
        onChange={(ev: React.ChangeEvent<HTMLInputElement>) => p.onMudar(p.mascara ? p.mascara(ev.target.value) : ev.target.value)}
      />
    </CampoCaixa>
  );
}

type Opcao = string | { valor: string; rotulo: string };
interface CampoSelectProps extends CampoBaseProps {
  valor: string;
  onMudar: (v: string) => void;
  opcoes: readonly Opcao[];
  vazio?: string;
  desabilitado?: boolean;
}
function CampoSelect(p: CampoSelectProps) {
  return (
    <CampoCaixa id={p.id} rotulo={p.rotulo} erro={p.erro} dica={p.dica} className={p.className}>
      <select
        id={p.id}
        name={p.id}
        value={p.valor}
        disabled={p.desabilitado}
        aria-invalid={p.erro ? true : undefined}
        aria-describedby={descrito(p.id, p.erro, p.dica)}
        className="ip-input"
        onChange={(ev: React.ChangeEvent<HTMLSelectElement>) => p.onMudar(ev.target.value)}
      >
        {p.vazio !== undefined && <option value="">{p.vazio}</option>}
        {p.opcoes.map((o) => {
          const valor = typeof o === 'string' ? o : o.valor;
          const rotulo = typeof o === 'string' ? o : o.rotulo;
          return (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          );
        })}
      </select>
    </CampoCaixa>
  );
}

function CampoTextarea(p: CampoBaseProps & { valor: string; onMudar: (v: string) => void; placeholder?: string; linhas?: number; maxLength?: number }) {
  return (
    <CampoCaixa id={p.id} rotulo={p.rotulo} erro={p.erro} dica={p.dica} className={p.className}>
      <textarea
        id={p.id}
        name={p.id}
        value={p.valor}
        rows={p.linhas ?? 4}
        maxLength={p.maxLength}
        placeholder={p.placeholder}
        aria-invalid={p.erro ? true : undefined}
        aria-describedby={descrito(p.id, p.erro, p.dica)}
        className="ip-input"
        onChange={(ev: React.ChangeEvent<HTMLTextAreaElement>) => p.onMudar(ev.target.value)}
      />
    </CampoCaixa>
  );
}

function Interruptor({ marcado, onMudar, rotulo, id }: { marcado: boolean; onMudar: (v: boolean) => void; rotulo: string; id?: string }) {
  return (
    <button type="button" role="switch" id={id} aria-checked={marcado} aria-label={rotulo} className="ip-switch" onClick={() => onMudar(!marcado)}>
      <span className="ip-switch-knob" />
    </button>
  );
}

function Chip({ ativo, onClick, children }: { ativo?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="ip-chip" aria-pressed={ativo} onClick={onClick}>
      {children}
    </button>
  );
}

/** Marca como inertes (e ocultos para leitores de tela) todos os irmãos dos ancestrais do modal até a raiz do app. */
function isolarModal(alvo: HTMLElement): () => void {
  const marcados: HTMLElement[] = [];
  const raiz = alvo.closest('.ip-root');
  let no: HTMLElement | null = alvo;
  while (no && raiz && no !== raiz) {
    const pai: HTMLElement | null = no.parentElement;
    if (!pai) break;
    Array.from(pai.children).forEach((irmao) => {
      if (irmao === no || !(irmao instanceof HTMLElement) || irmao.tagName === 'STYLE' || irmao.tagName === 'SCRIPT' || irmao.hasAttribute('inert')) return;
      irmao.setAttribute('inert', '');
      irmao.setAttribute('aria-hidden', 'true');
      marcados.push(irmao);
    });
    no = pai;
  }
  return () =>
    marcados.forEach((e) => {
      e.removeAttribute('inert');
      e.removeAttribute('aria-hidden');
    });
}

// ── Modal acessível: role="dialog", foco inicial, Tab preso, fecha com Esc ──
function Modal({
  aberto,
  titulo,
  onFechar,
  children,
  largura = 600,
  idTitulo = 'modal-titulo',
}: {
  aberto: boolean;
  titulo: string;
  onFechar: () => void;
  children: React.ReactNode;
  largura?: number;
  idTitulo?: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const fechar = useRef(onFechar);
  fechar.current = onFechar;

  useEffect(() => {
    if (!aberto) return undefined;
    const anterior = document.activeElement as HTMLElement | null;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const liberarFundo = caixa.current ? isolarModal(caixa.current) : () => undefined;
    const foco = window.setTimeout(() => {
      const raiz = caixa.current;
      if (!raiz) return;
      const alvo =
        raiz.querySelector<HTMLElement>('[data-foco-inicial]') ??
        raiz.querySelector<HTMLElement>('textarea, input, select') ??
        raiz.querySelector<HTMLElement>('button:not([data-fechar])');
      (alvo ?? raiz).focus();
    }, 0);
    const aoTeclar = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.stopPropagation();
        fechar.current();
        return;
      }
      if (ev.key !== 'Tab' || !caixa.current) return;
      const itens = Array.from(
        caixa.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), textarea, input, select, [tabindex]:not([tabindex="-1"])'),
      ).filter((x) => x.offsetParent !== null);
      if (!itens.length) return;
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      if (ev.shiftKey && document.activeElement === primeiro) {
        ev.preventDefault();
        ultimo.focus();
      } else if (!ev.shiftKey && document.activeElement === ultimo) {
        ev.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => {
      window.clearTimeout(foco);
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflowAnterior;
      liberarFundo();
      if (anterior && typeof anterior.focus === 'function') anterior.focus();
    };
  }, [aberto]);

  if (!aberto) return null;
  return (
    <div
      className="ip-overlay"
      onMouseDown={(ev: React.MouseEvent<HTMLDivElement>) => {
        if (ev.target === ev.currentTarget) onFechar();
      }}
    >
      <div ref={caixa} role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1} className="ip-modal ip-shadow" style={{ maxWidth: largura }}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id={idTitulo} className="ip-h2-lg">
            {titulo}
          </h2>
          <button type="button" data-fechar="true" className="ip-iconbtn -mr-2 -mt-2 text-ip-muted" onClick={onFechar} aria-label="Fechar janela">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Passos (Stepper) ─────────────────────────────────────────────────────────
function Passos({ atual, itens }: { atual: number; itens: string[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2" aria-label="Etapas da reserva">
      {itens.map((rotulo, i) => (
        <li key={rotulo} className="flex items-center gap-3" aria-current={i === atual ? 'step' : undefined}>
          <span className={`ip-step ${i <= atual ? 'ip-step-on' : ''}`}>{i < atual ? <Check size={14} /> : i + 1}</span>
          <span className={`text-sm ${i === atual ? 'font-semibold text-ip-ink' : 'font-medium text-ip-muted'}`}>{rotulo}</span>
          {i < itens.length - 1 && <span className="ip-step-line" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

// ── Foto do espaço: ilustração própria (os links do Figma expiram — premissa 9) ──
function FotoEspaco({ espaco }: { espaco: Espaco }) {
  if (espaco.foto) {
    return <img src={espaco.foto} alt={`Foto: ${espaco.nome}`} className="h-full w-full object-cover" />;
  }
  return (
    <svg viewBox="0 0 200 140" className="h-full w-full" role="img" aria-label={`Ilustração: ${espaco.nome}`} preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="140" fill="#e6ecf4" />
      <rect y="106" width="200" height="34" fill="#d4deec" />
      {espaco.arte === 'auditorio' && (
        <g>
          <rect x="44" y="18" width="112" height="48" rx="3" fill="#ffffff" />
          <rect x="50" y="24" width="100" height="36" rx="2" fill="#1f6feb" opacity="0.14" />
          <path d="M60 52 L82 40 L98 47 L118 33 L140 45" stroke="#1f6feb" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="28" y="70" width="144" height="8" rx="2" fill="#b7c6dc" />
          {[0, 1, 2].map((r) =>
            [0, 1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
              <rect key={`${r}-${c}`} x={22 + c * 17} y={88 + r * 14} width="12" height="9" rx="3" fill={r === 1 ? '#8fa7cb' : '#9fb4d3'} />
            )),
          )}
        </g>
      )}
      {espaco.arte === 'sala' && (
        <g>
          <rect x="56" y="16" width="88" height="50" rx="3" fill="#2b3f5c" />
          <rect x="62" y="22" width="76" height="38" rx="2" fill="#3a5a8c" />
          <circle cx="100" cy="41" r="9" fill="#ffffff" opacity="0.85" />
          <rect x="46" y="86" width="108" height="12" rx="6" fill="#ffffff" />
          <rect x="62" y="98" width="6" height="16" fill="#b7c6dc" />
          <rect x="132" y="98" width="6" height="16" fill="#b7c6dc" />
          {[58, 84, 110, 136].map((x) => (
            <rect key={x} x={x} y="74" width="16" height="11" rx="5" fill="#9fb4d3" />
          ))}
          <rect x="30" y="88" width="12" height="20" rx="5" fill="#9fb4d3" />
          <rect x="158" y="88" width="12" height="20" rx="5" fill="#9fb4d3" />
        </g>
      )}
      {espaco.arte === 'mentoria' && (
        <g>
          <rect x="42" y="16" width="116" height="58" rx="3" fill="#ffffff" stroke="#b7c6dc" strokeWidth="3" />
          <path d="M58 36 H104 M58 48 H136 M58 60 H92" stroke="#1f6feb" opacity="0.55" strokeWidth="3" strokeLinecap="round" />
          <rect x="44" y="88" width="36" height="32" rx="11" fill="#9fb4d3" />
          <rect x="120" y="88" width="36" height="32" rx="11" fill="#9fb4d3" />
          <rect x="88" y="100" width="24" height="18" rx="5" fill="#ffffff" />
        </g>
      )}
      {espaco.arte === 'generico' && (
        <g>
          <rect x="62" y="26" width="76" height="86" rx="4" fill="#ffffff" />
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2].map((c) => <rect key={`${r}-${c}`} x={72 + c * 22} y={36 + r * 17} width="14" height="10" rx="2" fill="#b7c6dc" />),
          )}
          <rect x="91" y="94" width="18" height="18" rx="2" fill="#1f6feb" opacity="0.7" />
        </g>
      )}
    </svg>
  );
}

// ── Card Espaço ──────────────────────────────────────────────────────────────
function CartaoEspaco({
  espaco,
  disponivel,
  onReservar,
  destacado = false,
}: {
  espaco: Espaco;
  disponivel: boolean;
  onReservar: () => void;
  destacado?: boolean;
}) {
  return (
    <article className={`ip-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 ${destacado ? 'ip-card-destaque' : ''}`} aria-label={espaco.nome}>
      <div className="ip-foto">
        <FotoEspaco espaco={espaco} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h3 className="text-lg font-bold">{espaco.nome}</h3>
          <Tag tom={disponivel ? 'ok' : 'erro'}>{disponivel ? 'Disponível' : 'Indisponível'}</Tag>
        </div>
        <p className="ip-t13 mt-1.5 font-medium text-ip-muted">
          Capacidade: {espaco.capacidade} pessoas · {espaco.tipo}
        </p>
        <p className="ip-t13 mt-1 text-ip-muted">{espaco.recursos.length ? espaco.recursos.join(' · ') : 'Sem recursos cadastrados'}</p>
      </div>
      <div className="sm:shrink-0">
        <Botao variante="primario" desabilitado={!disponivel} onClick={onReservar} className="w-full sm:w-auto">
          {disponivel ? 'Reservar' : 'Indisponível'}
        </Botao>
      </div>
    </article>
  );
}

// ── Painel Resumo (coluna de 360 px) ─────────────────────────────────────────
function PainelResumo({ titulo = 'Resumo da solicitação', linhas, aviso }: { titulo?: string; linhas: { rotulo: string; valor: string }[]; aviso?: string }) {
  return (
    <aside className="ip-card ip-aside p-5" aria-label={titulo}>
      <h2 className="ip-h2">{titulo}</h2>
      <dl className="mt-4 flex flex-col gap-3">
        {linhas.map((l) => (
          <div key={l.rotulo} className="flex items-baseline justify-between gap-4">
            <dt className="text-xs font-medium text-ip-muted">{l.rotulo}</dt>
            <dd className="text-right text-sm font-semibold">{l.valor}</dd>
          </div>
        ))}
      </dl>
      {aviso && <p className="ip-t13 mt-4 rounded-lg bg-ip-bg p-3 text-ip-muted">{aviso}</p>}
    </aside>
  );
}

function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: string | number; detalhe?: string }) {
  return (
    <div className="ip-card p-5">
      <p className="text-xs font-medium text-ip-muted">{rotulo}</p>
      <p className="mt-1 text-3xl font-bold">{valor}</p>
      {detalhe && <p className="ip-t13 mt-1 text-ip-muted">{detalhe}</p>}
    </div>
  );
}

function EstadoVazio({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-ip-line bg-white p-8 text-center">
      <Inbox size={28} className="mx-auto text-ip-muted" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold">{titulo}</p>
      {texto && <p className="ip-t13 mt-1 text-ip-muted">{texto}</p>}
    </div>
  );
}

function ListaHistorico({ itens }: { itens: Historico[] }) {
  if (!itens.length) return <p className="ip-t13 text-ip-muted">Sem registros.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {itens.map((h) => (
        <li key={h.id} className="ip-hist">
          <p className="text-xs font-semibold">
            {h.autor}
            {h.de !== null && h.de !== h.para ? ` · ${h.de} → ${h.para}` : ` · ${h.para}`}
            <span className="ml-2 font-normal text-ip-muted">{fmtDataHora(h.quando)}</span>
          </p>
          {h.nota && <p className="ip-t13 mt-0.5 text-ip-muted">{h.nota}</p>}
        </li>
      ))}
    </ol>
  );
}

function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex shrink-0 items-center gap-2.5 rounded-lg border-0 bg-transparent p-0 text-left" aria-label="InPETU hub — início">
      <span className="ip-logo" aria-hidden="true">
        I
      </span>
      <span className="text-lg font-bold">InPETU hub</span>
    </button>
  );
}

/** Contêiner de página: título 28 px, subtítulo e área de ação. */
function Pagina({ titulo, subtitulo, acao, children }: { titulo: string; subtitulo?: string; acao?: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.focus({ preventScroll: true });
  }, [titulo]);
  return (
    <div className="ip-gutter">
      <div className="ip-wrap py-8 sm:py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 ref={ref} tabIndex={-1} className="ip-h1">
              {titulo}
            </h1>
            {subtitulo && <p className="mt-2 max-w-3xl text-base text-ip-muted">{subtitulo}</p>}
          </div>
          {acao}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Avisos de e-mail simulados; somem sozinhos em 4 s. */
function Toasts() {
  const { estado, despachar } = useLoja();
  const agendados = useRef<Set<number>>(new Set());
  useEffect(() => {
    estado.toasts.forEach((t) => {
      if (agendados.current.has(t.id)) return;
      agendados.current.add(t.id);
      window.setTimeout(() => despachar({ tipo: 'toast/fechar', id: t.id }), 4000);
    });
  }, [estado.toasts, despachar]);
  if (!estado.toasts.length) return null;
  return (
    <div className="ip-toasts" aria-live="polite">
      {estado.toasts.map((t) => (
        <div key={t.id} className="ip-toast" role="status">
          <Mail size={16} className="mt-1 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">{t.titulo}</p>
            <p className="break-words text-xs opacity-90">{t.texto}</p>
          </div>
          <button type="button" className="ip-iconbtn" onClick={() => despachar({ tipo: 'toast/fechar', id: t.id })} aria-label="Fechar aviso de e-mail">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}


/* ═════════════════════════════════════════════════════════════════════════════
   6 · TELAS DO VISITANTE (público, sem login)
   H Home · 1 → 1b → 2 → 3 (reserva) · V4 → V4b → V5 (visita) · V6 → V7 (chamado)
   ═════════════════════════════════════════════════════════════════════════════ */

type TelaVisitante = 'home' | 'reserva1' | 'reserva2' | 'reserva3' | 'visita' | 'visitaOk' | 'chamado' | 'chamadoOk';
const PASSOS_RESERVA = ['Espaço e horário', 'Seus dados', 'Confirmação'];

interface DadosReserva {
  nome: string;
  email: string;
  telefone: string;
  empresa: string;
  tipo: string;
  participantes: string;
  finalidade: string;
}
interface ConflitoReserva {
  espacoId: string;
  bloco: Bloqueio;
  sugestoes: { inicio: string; fim: string }[];
}
interface RascunhoReserva {
  filtros: { data: string; inicio: string; fim: string }; // o que está nos campos
  consulta: { data: string; inicio: string; fim: string } | null; // o que foi consultado (data ISO)
  espacoId: string | null;
  conflito: ConflitoReserva | null;
  dados: DadosReserva;
}
const DADOS_VAZIOS: DadosReserva = { nome: '', email: '', telefone: '', empresa: '', tipo: '', participantes: '', finalidade: '' };

/** Valores iniciais do Figma: 12/11/2026, 14:00 – 15:00 (29 dias depois do "hoje" simulado). */
function novoRascunho(): RascunhoReserva {
  const dataIso = somarDias(hoje(), 29);
  return {
    filtros: { data: fmtData(dataIso), inicio: '14:00', fim: '15:00' },
    consulta: { data: dataIso, inicio: '14:00', fim: '15:00' },
    espacoId: null,
    conflito: null,
    dados: DADOS_VAZIOS,
  };
}

type Erros = Record<string, string>;
function soComMensagem(mapa: Record<string, string | null>): Erros {
  const saida: Erros = {};
  Object.entries(mapa).forEach(([k, v]) => {
    if (v) saida[k] = v;
  });
  return saida;
}
/** Leva o foco ao primeiro campo com erro (acessibilidade). */
function focarPrimeiroErro(ordem: string[], erros: Erros) {
  const alvo = ordem.find((id) => erros[id]);
  if (alvo) window.setTimeout(() => document.getElementById(alvo)?.focus(), 0);
}

function Confirmacao({
  titulo,
  tag,
  linhas,
  texto,
  acoes,
}: {
  titulo: string;
  tag: React.ReactNode;
  linhas: { rotulo: string; valor: string }[];
  texto: string;
  acoes: React.ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.focus({ preventScroll: true });
  }, []);
  return (
    <div className="ip-gutter">
      <div className="ip-wrap py-8 sm:py-14">
        <div className="ip-card ip-card-lg mx-auto flex max-w-xl flex-col items-center gap-4 p-6 text-center sm:p-10">
          <span className="ip-check" aria-hidden="true">
            <Check size={28} strokeWidth={3} />
          </span>
          <h1 ref={ref} tabIndex={-1} className="ip-h2-lg">
            {titulo}
          </h1>
          {tag}
          {linhas.length > 0 && (
            <dl className="ip-caixa flex w-full flex-col gap-2 text-left">
              {linhas.map((l) => (
                <div key={l.rotulo} className="flex items-baseline justify-between gap-4">
                  <dt className="text-xs font-medium text-ip-muted">{l.rotulo}</dt>
                  <dd className="text-right text-sm font-semibold">{l.valor}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="text-sm text-ip-muted">{texto}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">{acoes}</div>
        </div>
      </div>
    </div>
  );
}

/* ── H · Home ───────────────────────────────────────────────────────────────── */

function Home({ irPara }: { irPara: (t: TelaVisitante) => void }) {
  const servicos = [
    {
      icone: <Calendar size={22} aria-hidden="true" />,
      titulo: 'Reservar espaço',
      texto: 'Auditório, sala de reuniões e sala de mentoria por data e horário.',
      acao: 'Reservar',
      destino: 'reserva1' as TelaVisitante,
      variante: 'primario' as const,
    },
    {
      icone: <Building2 size={22} aria-hidden="true" />,
      titulo: 'Visita técnica guiada',
      texto: 'Conheça o hub e as startups residentes. Peça com 3 dias úteis de antecedência.',
      acao: 'Solicitar visita',
      destino: 'visita' as TelaVisitante,
      variante: 'primario' as const,
    },
    {
      icone: <LifeBuoy size={22} aria-hidden="true" />,
      titulo: 'Abrir chamado',
      texto: 'Relate problemas de infraestrutura, equipamentos, Wi-Fi ou acesso.',
      acao: 'Abrir chamado',
      destino: 'chamado' as TelaVisitante,
      variante: 'secundario' as const,
    },
  ];
  return (
    <div>
      <section className="ip-hero-sec ip-gutter">
        <div className="ip-wrap py-14 sm:py-24">
          <h1 className="ip-hero max-w-3xl">Reserve espaços, agende visitas e peça suporte no InPETU hub</h1>
          <p className="mt-5 max-w-2xl text-lg text-ip-muted">Sem criar conta: escolha o serviço, preencha seus dados e acompanhe a resposta por e-mail.</p>
        </div>
      </section>
      <div className="ip-gutter">
        <div className="ip-wrap flex flex-col gap-12 py-12">
          <section aria-labelledby="h-servicos">
            <h2 id="h-servicos" className="ip-sec">
              O que você precisa?
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
              {servicos.map((s) => (
                <article key={s.titulo} className="ip-card ip-card-lg flex flex-col gap-3 p-6 sm:p-7">
                  <span className="ip-icone">{s.icone}</span>
                  <h3 className="text-xl font-bold">{s.titulo}</h3>
                  <p className="text-sm text-ip-muted">{s.texto}</p>
                  <div className="mt-auto pt-2">
                    <Botao variante={s.variante} onClick={() => irPara(s.destino)}>
                      {s.acao}
                    </Botao>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <Alerta tom="aviso" titulo="Toda solicitação passa por aprovação">
            Reservas e visitas ficam "Pendentes" até a confirmação do Gestor do Hub, e você é avisado por e-mail.
          </Alerta>
          <MinhasSolicitacoes />
        </div>
      </div>
    </div>
  );
}

/** resumo das solicitações do visitante, buscado pelo e-mail (não há conta). */
function MinhasSolicitacoes() {
  const { estado, despachar } = useLoja();
  const [campo, setCampo] = useState(estado.ultimoEmail);
  const [aplicado, setAplicado] = useState(estado.ultimoEmail);
  const [erro, setErro] = useState<string | null>(null);

  const buscar = (valor: string) => {
    const e = validarEmail(valor);
    setErro(e);
    if (e) return;
    setAplicado(emailNorm(valor));
    despachar({ tipo: 'ultimoEmail', email: valor });
  };

  const itens = useMemo(() => {
    const lista = [
      ...estado.reservas
        .filter((r) => r.email === aplicado)
        .map((r) => ({
          chave: `r-${r.id}`,
          ordem: r.criadoEm,
          icone: <Calendar size={18} aria-hidden="true" />,
          titulo: `${nomeDoEspaco(estado, r.espacoId)} · ${fmtData(r.data)}, ${faixa(r.inicio, r.fim)}`,
          detalhe: `Reserva · ${r.finalidade}`,
          status: r.status as string,
          ativo: r.status !== 'Recusada',
          motivo: r.motivoRecusa,
        })),
      ...estado.visitas
        .filter((v) => v.email === aplicado)
        .map((v) => ({
          chave: `v-${v.id}`,
          ordem: v.criadoEm,
          icone: <Building2 size={18} aria-hidden="true" />,
          titulo: `Visita técnica · ${fmtData(v.data)}, ${faixa(v.inicio, v.fim)}`,
          detalhe: `${v.instituicao} · ${plural(v.visitantes, 'visitante', 'visitantes')}`,
          status: v.status as string,
          ativo: v.status !== 'Recusada',
          motivo: v.motivoRecusa,
        })),
      ...estado.chamados
        .filter((c) => c.email === aplicado)
        .map((c) => ({
          chave: `c-${c.numero}`,
          ordem: `${c.abertoEm}T23:59`,
          icone: <LifeBuoy size={18} aria-hidden="true" />,
          titulo: `Chamado #${c.numero} · ${c.assunto}`,
          detalhe: `Chamado · aberto em ${fmtData(c.abertoEm)}`,
          status: c.status as string,
          ativo: c.status !== 'Fechado' && c.status !== 'Resolvido',
          motivo: undefined as string | undefined,
        })),
    ];
    return lista.sort((a, b) => Number(b.ativo) - Number(a.ativo) || b.ordem.localeCompare(a.ordem));
  }, [estado.reservas, estado.visitas, estado.chamados, estado.espacos, aplicado]);

  const exemplos = ['nilda@empresa.com.br', 'rafael@startupbeta.com', 'visitas@escola.edu.br'];

  return (
    <section aria-labelledby="h-minhas" className="ip-card p-5 sm:p-6">
      <h2 id="h-minhas" className="ip-sec">
        Suas solicitações
      </h2>
      <p className="mt-1 text-sm text-ip-muted">Como não há conta, a busca é pelo e-mail usado no pedido. Reservas, visitas e chamados aparecem com o status atual.</p>
      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start"
        noValidate
        onSubmit={(ev: React.FormEvent<HTMLFormElement>) => {
          ev.preventDefault();
          buscar(campo);
        }}
      >
        <CampoTexto id="busca-email" rotulo="E-mail do solicitante" valor={campo} onMudar={setCampo} erro={erro} placeholder="nome@empresa.com.br" tipo="email" className="sm:max-w-md sm:flex-1" />
        <div className="ip-sob-rotulo">
          <Botao tipo="submit" variante="secundario">
            <Search size={16} aria-hidden="true" />
            Buscar
          </Botao>
        </div>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-ip-muted">Exemplos:</span>
        {exemplos.map((x) => (
          <Chip
            key={x}
            onClick={() => {
              setCampo(x);
              buscar(x);
            }}
          >
            {x}
          </Chip>
        ))}
      </div>
      <div className="mt-5" aria-live="polite">
        {itens.length === 0 ? (
          <EstadoVazio titulo={`Nenhuma solicitação para ${aplicado}`} texto="Faça uma reserva, peça uma visita ou abra um chamado e ela aparece aqui." />
        ) : (
          <ul className="flex flex-col gap-3">
            {itens.map((i) => (
              <li key={i.chave} className={`flex flex-wrap items-start gap-3 rounded-xl border border-ip-line p-4 ${i.ativo ? 'bg-white' : 'bg-ip-bg'}`}>
                <span className="mt-0.5 text-ip-muted">{i.icone}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{i.titulo}</p>
                  <p className="ip-t13 mt-0.5 text-ip-muted">{i.detalhe}</p>
                  {i.motivo && <p className="ip-t13 mt-1 text-ip-bad">Justificativa do Gestor: {i.motivo}</p>}
                </div>
                <TagStatus status={i.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ── 1 · Espaço e horário  (+ 1b · Conflito de horário) ─────────────────────── */

function ReservaPasso1({
  rascunho,
  setRascunho,
  irPara,
}: {
  rascunho: RascunhoReserva;
  setRascunho: (f: (r: RascunhoReserva) => RascunhoReserva) => void;
  irPara: (t: TelaVisitante) => void;
}) {
  const { estado } = useLoja();
  const [erros, setErros] = useState<{ data?: string; periodo?: string }>({});
  const { filtros, consulta, conflito } = rascunho;

  const mudarFiltro = (campo: 'data' | 'inicio' | 'fim', valor: string) =>
    setRascunho((r) => ({ ...r, filtros: { ...r.filtros, [campo]: valor }, conflito: null }));

  const consultar = () => {
    const d = validarDataReserva(filtros.data);
    const p = validarPeriodo(filtros.inicio, filtros.fim);
    setErros({ data: d.erro ?? undefined, periodo: p ?? undefined });
    if (d.erro || p) return;
    setRascunho((r) => ({ ...r, consulta: { data: d.iso as string, inicio: filtros.inicio, fim: filtros.fim }, conflito: null, espacoId: null }));
  };

  const reservar = (esp: Espaco) => {
    if (!consulta) return;
    if (consulta.data < hoje()) {
      setErros({ data: 'A data não pode estar no passado.' });
      return;
    }
    const periodo = { espacoId: esp.id, ...consulta };
    const bloco = temConflito(estado, periodo);
    if (bloco) {
      setRascunho((r) => ({ ...r, conflito: { espacoId: esp.id, bloco, sugestoes: sugerirHorarios(estado, periodo) } }));
      return;
    }
    setRascunho((r) => ({ ...r, espacoId: esp.id, conflito: null }));
    irPara('reserva2');
  };

  const escolherHorario = (s: { inicio: string; fim: string }) => {
    setErros({});
    setRascunho((r) => ({
      ...r,
      filtros: { ...r.filtros, inicio: s.inicio, fim: s.fim },
      consulta: r.consulta ? { ...r.consulta, inicio: s.inicio, fim: s.fim } : r.consulta,
      conflito: null,
    }));
  };

  const espacoConflito = conflito ? estado.espacos.find((x) => x.id === conflito.espacoId) : undefined;
  const duracao = consulta ? emMin(consulta.fim) - emMin(consulta.inicio) : 0;

  return (
    <Pagina titulo="Reservar espaço" subtitulo="Escolha a data e o horário e veja quais espaços estão livres. Toda reserva passa por aprovação do Gestor.">
      <div className="ip-cols">
        <div className="ip-main flex flex-col gap-6">
          <Passos atual={0} itens={PASSOS_RESERVA} />

          <form
            className="ip-card p-4 sm:p-5"
            onSubmit={(ev: React.FormEvent<HTMLFormElement>) => {
              ev.preventDefault();
              consultar();
            }}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-start">
              <CampoTexto id="f-data" rotulo="Data" valor={filtros.data} onMudar={(v) => mudarFiltro('data', v)} mascara={mascaraData} placeholder="dd/mm/aaaa" inputMode="numeric" maxLength={10} erro={erros.data} />
              <CampoSelect id="f-inicio" rotulo="Início" valor={filtros.inicio} onMudar={(v) => mudarFiltro('inicio', v)} opcoes={HORARIOS} />
              <CampoSelect id="f-fim" rotulo="Fim" valor={filtros.fim} onMudar={(v) => mudarFiltro('fim', v)} opcoes={HORARIOS} erro={erros.periodo} />
              <div className="flex flex-col gap-1.5">
                <span className="hidden text-xs lg:block" aria-hidden="true">
                  &nbsp;
                </span>
                <Botao tipo="submit" bloco>
                  <Search size={16} aria-hidden="true" />
                  Consultar
                </Botao>
              </div>
            </div>
          </form>

          {conflito && espacoConflito && consulta && (
            <div className="flex flex-col gap-4">
              <Alerta tom="erro" titulo="Conflito de horário">
                A {espacoConflito.nome} já possui {conflito.bloco.origem === 'reuniao' ? 'uma reunião interna' : 'uma reserva'} nesta faixa ({faixa(conflito.bloco.inicio, conflito.bloco.fim)}). Escolha um dos
                horários livres abaixo ou outro espaço.
              </Alerta>
              <section className="ip-card p-4 sm:p-5" aria-labelledby="h-sugestoes">
                <h2 id="h-sugestoes" className="ip-h2">
                  Horários livres sugeridos
                </h2>
                <p className="ip-t13 mt-1 text-ip-muted">
                  {espacoConflito.nome} · {fmtData(consulta.data)} · mesma duração do pedido ({duracao % 60 === 0 ? `${duracao / 60} h` : `${duracao} min`})
                </p>
                {conflito.sugestoes.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {conflito.sugestoes.map((s) => (
                      <Chip key={s.inicio} onClick={() => escolherHorario(s)}>
                        <Clock size={14} aria-hidden="true" />
                        {faixa(s.inicio, s.fim)}
                      </Chip>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-ip-muted">Não há horários livres com essa duração neste dia. Tente outra data ou outro espaço.</p>
                )}
              </section>
            </div>
          )}

          <section aria-labelledby="h-espacos" className="flex flex-col gap-4">
            <h2 id="h-espacos" className="ip-h2">
              Espaços
            </h2>
            {consulta ? (
              estado.espacos.map((esp) => (
                <CartaoEspaco
                  key={esp.id}
                  espaco={esp}
                  disponivel={espacoDisponivel(estado, esp, consulta)}
                  destacado={conflito?.espacoId === esp.id}
                  onReservar={() => reservar(esp)}
                />
              ))
            ) : (
              <EstadoVazio titulo="Informe data e horário" texto="Preencha os filtros e clique em Consultar para ver os espaços." />
            )}
          </section>
        </div>
        <PainelResumo
          linhas={[
            { rotulo: 'Espaço', valor: 'Escolha um espaço' },
            { rotulo: 'Data', valor: consulta ? fmtData(consulta.data) : '—' },
            { rotulo: 'Horário', valor: consulta ? faixa(consulta.inicio, consulta.fim) : '—' },
            { rotulo: 'Status', valor: 'Pendente de aprovação' },
          ]}
          aviso="Toda solicitação passa por aprovação do Gestor."
        />
      </div>
    </Pagina>
  );
}

/* ── 2 · Seus dados ─────────────────────────────────────────────────────────── */

function ReservaPasso2({
  rascunho,
  setRascunho,
  irPara,
}: {
  rascunho: RascunhoReserva;
  setRascunho: (f: (r: RascunhoReserva) => RascunhoReserva) => void;
  irPara: (t: TelaVisitante) => void;
}) {
  const { estado, despachar } = useLoja();
  const esp = estado.espacos.find((x) => x.id === rascunho.espacoId);
  const { consulta, dados } = rascunho;
  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (!esp || !consulta) irPara('reserva1');
  }, []);
  if (!esp || !consulta) return null;

  const mudar = (campo: keyof DadosReserva, valor: string) => {
    setRascunho((r) => ({ ...r, dados: { ...r.dados, [campo]: valor } }));
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: '' }));
  };
  const participantes = /^\d+$/.test(dados.participantes.trim()) ? Number(dados.participantes) : 0;
  const excede = participantes > esp.capacidade;

  const enviar = () => {
    const mapa: Record<string, string | null> = {
      nome: validarNome(dados.nome),
      email: validarEmail(dados.email),
      telefone: validarTelefone(dados.telefone),
      tipo: validarObrigatorio(dados.tipo, 'Selecione o tipo de solicitante.'),
      participantes: validarInteiroMin1(dados.participantes),
      finalidade: validarTexto10(dados.finalidade),
    };
    if (!mapa.participantes && BLOQUEAR_CAPACIDADE && excede) {
      mapa.participantes = `O número de participantes excede a capacidade (${esp.capacidade}).`;
    }
    const e = soComMensagem(mapa);
    setErros(e);
    if (Object.keys(e).length) {
      focarPrimeiroErro(['nome', 'email', 'telefone', 'empresa', 'tipo', 'participantes', 'finalidade'], e);
      return;
    }
    // Revalida o conflito: outra solicitação pode ter ocupado a faixa enquanto o formulário era preenchido.
    const periodo = { espacoId: esp.id, ...consulta };
    const bloco = temConflito(estado, periodo);
    if (bloco) {
      setRascunho((r) => ({ ...r, conflito: { espacoId: esp.id, bloco, sugestoes: sugerirHorarios(estado, periodo) } }));
      irPara('reserva1');
      return;
    }
    setEnviando(true);
    timer.current = window.setTimeout(() => {
      despachar({
        tipo: 'reserva/criar',
        dados: {
          espacoId: esp.id,
          data: consulta.data,
          inicio: consulta.inicio,
          fim: consulta.fim,
          nome: dados.nome.trim(),
          email: dados.email,
          telefone: dados.telefone,
          empresa: dados.empresa.trim(),
          tipo: dados.tipo as TipoSolicitante,
          participantes,
          finalidade: dados.finalidade.trim(),
        },
      });
      irPara('reserva3');
    }, 600);
  };

  const preencherExemplo = () => {
    setErros({});
    setRascunho((r) => ({
      ...r,
      dados: {
        nome: 'Nilda Crisantemo Germach',
        email: 'nilda@empresa.com.br',
        telefone: '(48) 99999-0000',
        empresa: 'Tech Solutions',
        tipo: 'Empreendedor',
        participantes: '20',
        finalidade: 'Palestra para os funcionários da empresa',
      },
    }));
  };

  return (
    <Pagina titulo="Seus dados" subtitulo="Informe quem está pedindo o espaço. Não é preciso criar conta.">
      <div className="ip-cols">
        <div className="ip-main flex flex-col gap-6">
          <Passos atual={1} itens={PASSOS_RESERVA} />
          <form
            className="ip-card flex flex-col gap-5 p-4 sm:p-6"
            noValidate
            onSubmit={(ev: React.FormEvent<HTMLFormElement>) => {
              ev.preventDefault();
              enviar();
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="ip-h2">Dados do solicitante</h2>
              <Botao variante="fantasma" pequeno onClick={preencherExemplo}>
                Preencher com exemplo
              </Botao>
            </div>
            <CampoTexto id="nome" rotulo="Nome completo" valor={dados.nome} onMudar={(v) => mudar('nome', v)} erro={erros.nome} autoComplete="name" />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <CampoTexto id="email" rotulo="E-mail" tipo="email" valor={dados.email} onMudar={(v) => mudar('email', v)} erro={erros.email} placeholder="nome@empresa.com.br" autoComplete="email" />
              <CampoTexto id="telefone" rotulo="Telefone" valor={dados.telefone} onMudar={(v) => mudar('telefone', v)} mascara={formatarTelefone} erro={erros.telefone} placeholder="(48) 99999-0000" inputMode="tel" autoComplete="tel" />
              <CampoTexto id="empresa" rotulo="Empresa / Startup" valor={dados.empresa} onMudar={(v) => mudar('empresa', v)} erro={erros.empresa} autoComplete="organization" />
              <CampoSelect id="tipo" rotulo="Tipo de solicitante" valor={dados.tipo} onMudar={(v) => mudar('tipo', v)} opcoes={TIPOS_SOLICITANTE} vazio="Selecione" erro={erros.tipo} />
              <CampoTexto
                id="participantes"
                rotulo="Nº estimado de participantes"
                valor={dados.participantes}
                onMudar={(v) => mudar('participantes', v.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                erro={erros.participantes}
                dica={`Capacidade da ${esp.nome}: ${esp.capacidade} pessoas.`}
              />
            </div>
            {excede && (
              <Alerta tom="aviso" titulo="Atenção à capacidade">
                A {esp.nome} comporta até {esp.capacidade} pessoas e você informou {participantes}.{' '}
                {BLOQUEAR_CAPACIDADE ? 'Reduza o número de participantes para enviar a solicitação.' : 'Você pode enviar a solicitação mesmo assim.'}
              </Alerta>
            )}
            <CampoTextarea id="finalidade" rotulo="Finalidade" valor={dados.finalidade} onMudar={(v) => mudar('finalidade', v)} erro={erros.finalidade} placeholder="Descreva a atividade que será realizada" linhas={3} />
            <p className="ip-t13 text-ip-muted">Usamos nome, e-mail, telefone e empresa só para analisar e responder esta solicitação (LGPD).</p>
            <div className="flex flex-wrap justify-end gap-3">
              <Botao variante="secundario" onClick={() => irPara('reserva1')} desabilitado={enviando}>
                <ArrowLeft size={16} aria-hidden="true" />
                Voltar
              </Botao>
              <Botao tipo="submit" carregando={enviando}>
                Enviar solicitação
              </Botao>
            </div>
          </form>
        </div>
        <PainelResumo
          linhas={[
            { rotulo: 'Espaço', valor: esp.nome },
            { rotulo: 'Data', valor: fmtData(consulta.data) },
            { rotulo: 'Horário', valor: faixa(consulta.inicio, consulta.fim) },
            { rotulo: 'Participantes', valor: participantes ? String(participantes) : '—' },
            { rotulo: 'Status', valor: 'Pendente de aprovação' },
          ]}
          aviso="Você receberá a resposta do Gestor por e-mail."
        />
      </div>
    </Pagina>
  );
}

/* ── 3 · Confirmação ────────────────────────────────────────────────────────── */

function ReservaConfirmacao({ irPara, novaReserva }: { irPara: (t: TelaVisitante) => void; novaReserva: () => void }) {
  const { estado } = useLoja();
  const r = estado.reservas.find((x) => x.id === estado.ultimo.reservaId);
  if (!r) return <Pagina titulo="Reserva">Nenhuma solicitação recente. <Botao onClick={() => irPara('home')}>Voltar ao início</Botao></Pagina>;
  return (
    <Confirmacao
      titulo="Solicitação registrada!"
      tag={<TagStatus status="Pendente" />}
      linhas={[
        { rotulo: 'Espaço', valor: nomeDoEspaco(estado, r.espacoId) },
        { rotulo: 'Data', valor: fmtData(r.data) },
        { rotulo: 'Horário', valor: faixa(r.inicio, r.fim) },
        { rotulo: 'Participantes', valor: String(r.participantes) },
      ]}
      texto={`O Gestor do Hub vai analisar o pedido e a resposta chega por e-mail (${r.email}). Toda solicitação passa por aprovação.`}
      acoes={
        <>
          <Botao onClick={() => irPara('home')}>Voltar ao início</Botao>
          <Botao variante="secundario" onClick={novaReserva}>
            Nova reserva
          </Botao>
        </>
      }
    />
  );
}

/* ── V4 · Solicitar visita técnica  (+ V4b · Erro de antecedência) ──────────── */

interface FormVisita {
  instituicao: string;
  email: string;
  telefone: string;
  data: string;
  inicio: string;
  visitantes: string;
  objetivo: string;
}
const VISITA_VAZIA: FormVisita = { instituicao: '', email: '', telefone: '', data: '', inicio: '10:00', visitantes: '', objetivo: '' };

function VisitaForm({ irPara }: { irPara: (t: TelaVisitante) => void }) {
  const { despachar } = useLoja();
  const [f, setF] = useState<FormVisita>(VISITA_VAZIA);
  const [erros, setErros] = useState<Erros>({});
  const [rn03, setRn03] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    },
    [],
  );
  const primeira = primeiraDataVisita();

  const mudar = (campo: keyof FormVisita, valor: string) => {
    setF((x) => ({ ...x, [campo]: valor }));
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: '' }));
    if (campo === 'data') setRn03(false);
  };

  const enviar = () => {
    const d = validarDataBR(f.data);
    const mapa: Record<string, string | null> = {
      instituicao: validarNome(f.instituicao) ? 'Informe a instituição ou o responsável (3 a 100 caracteres).' : null,
      email: validarEmail(f.email),
      telefone: validarTelefone(f.telefone),
      data: d.erro,
      visitantes: validarInteiroMin1(f.visitantes),
      objetivo: validarTexto10(f.objetivo),
    };
    let barrado = false;
    if (d.iso && !antecedenciaOk(d.iso)) {
      // bloqueia o envio e mostra a primeira data disponível
      mapa.data = `Escolha uma data a partir de ${fmtData(primeira)}.`;
      barrado = true;
    }
    setRn03(barrado);
    const e = soComMensagem(mapa);
    setErros(e);
    if (Object.keys(e).length) {
      focarPrimeiroErro(['instituicao', 'email', 'telefone', 'data', 'inicio', 'visitantes', 'objetivo'], e);
      return;
    }
    setEnviando(true);
    timer.current = window.setTimeout(() => {
      despachar({
        tipo: 'visita/criar',
        dados: {
          instituicao: f.instituicao.trim(),
          email: f.email,
          telefone: f.telefone,
          data: d.iso as string,
          inicio: f.inicio,
          visitantes: Number(f.visitantes),
          objetivo: f.objetivo.trim(),
        },
      });
      irPara('visitaOk');
    }, 600);
  };

  const exemplo = () => {
    setErros({});
    setRn03(false);
    setF({
      instituicao: 'SENAI',
      email: 'visitas@escola.edu.br',
      telefone: '(48) 3333-4444',
      data: '16/10/2026',
      inicio: '10:00',
      visitantes: '20',
      objetivo: 'Conhecer a estrutura do hub e as startups residentes',
    });
  };

  return (
    <Pagina titulo="Solicitar visita técnica" subtitulo="Visitas guiadas duram 1h30 e precisam ser pedidas com antecedência. O Gestor confirma por e-mail.">
      <div className="mx-auto max-w-3xl">
        <form
          className="ip-card flex flex-col gap-5 p-4 sm:p-6"
          noValidate
          onSubmit={(ev: React.FormEvent<HTMLFormElement>) => {
            ev.preventDefault();
            enviar();
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="ip-h2">Dados da visita</h2>
            <Botao variante="fantasma" pequeno onClick={exemplo}>
              Preencher com exemplo
            </Botao>
          </div>
          <CampoTexto id="instituicao" rotulo="Instituição / responsável" valor={f.instituicao} onMudar={(v) => mudar('instituicao', v)} erro={erros.instituicao} autoComplete="organization" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <CampoTexto id="email" rotulo="E-mail" tipo="email" valor={f.email} onMudar={(v) => mudar('email', v)} erro={erros.email} placeholder="nome@instituicao.edu.br" autoComplete="email" />
            <CampoTexto id="telefone" rotulo="Telefone" valor={f.telefone} onMudar={(v) => mudar('telefone', v)} mascara={formatarTelefone} erro={erros.telefone} placeholder="(48) 3333-4444" inputMode="tel" autoComplete="tel" />
          </div>
          {rn03 ? (
            <Alerta tom="erro" titulo="Antecedência mínima não atendida">
              <p>
                A visita deve ser solicitada com pelo menos 3 dias úteis de antecedência. Hoje é {fmtData(hoje())}: a primeira data disponível é {fmtData(primeira)}.
              </p>
              <div className="mt-2">
                <Botao variante="secundario" pequeno onClick={() => mudar('data', fmtData(primeira))}>
                  Usar {fmtData(primeira)}
                </Botao>
              </div>
            </Alerta>
          ) : (
            <Alerta tom="info" titulo="Antecedência mínima de 3 dias úteis">
              Escolha uma data a partir de {fmtData(primeira)}.
            </Alerta>
          )}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <CampoTexto id="data" rotulo="Data da visita" valor={f.data} onMudar={(v) => mudar('data', v)} mascara={mascaraData} placeholder="dd/mm/aaaa" inputMode="numeric" maxLength={10} erro={erros.data} />
            <CampoSelect id="inicio" rotulo="Horário" valor={f.inicio} onMudar={(v) => mudar('inicio', v)} opcoes={HORARIOS} dica={`Termina às ${somarMin(f.inicio, DURACAO_VISITA_MIN)}.`} />
            <CampoTexto id="visitantes" rotulo="Nº de visitantes" valor={f.visitantes} onMudar={(v) => mudar('visitantes', v.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" erro={erros.visitantes} />
          </div>
          <CampoTextarea id="objetivo" rotulo="Objetivo da visita" valor={f.objetivo} onMudar={(v) => mudar('objetivo', v)} erro={erros.objetivo} placeholder="O que o grupo quer conhecer ou discutir" linhas={3} />
          <div className="flex flex-wrap justify-end gap-3">
            <Botao variante="secundario" onClick={() => irPara('home')} desabilitado={enviando}>
              <ArrowLeft size={16} aria-hidden="true" />
              Voltar
            </Botao>
            <Botao tipo="submit" carregando={enviando}>
              Enviar solicitação
            </Botao>
          </div>
        </form>
      </div>
    </Pagina>
  );
}

/* ── V5 · Visita registrada ─────────────────────────────────────────────────── */

function VisitaConfirmacao({ irPara }: { irPara: (t: TelaVisitante) => void }) {
  const { estado } = useLoja();
  const v = estado.visitas.find((x) => x.id === estado.ultimo.visitaId);
  if (!v) return <Pagina titulo="Visita técnica">Nenhuma visita recente. <Botao onClick={() => irPara('home')}>Voltar ao início</Botao></Pagina>;
  return (
    <Confirmacao
      titulo="Solicitação de visita registrada!"
      tag={<TagStatus status="Pendente" />}
      linhas={[
        { rotulo: 'Instituição', valor: v.instituicao },
        { rotulo: 'Data', valor: fmtData(v.data) },
        { rotulo: 'Horário', valor: faixa(v.inicio, v.fim) },
        { rotulo: 'Visitantes', valor: String(v.visitantes) },
      ]}
      texto={`A equipe do Hub responde por e-mail (${v.email}) depois que o Gestor analisar o pedido.`}
      acoes={<Botao onClick={() => irPara('home')}>Voltar ao início</Botao>}
    />
  );
}

/* ── V6 · Abrir chamado ─────────────────────────────────────────────────────── */

interface FormChamado {
  nome: string;
  email: string;
  telefone: string;
  categoria: string;
  espaco: string;
  assunto: string;
  descricao: string;
}
const CHAMADO_VAZIO: FormChamado = { nome: '', email: '', telefone: '', categoria: '', espaco: '', assunto: '', descricao: '' };

function ChamadoForm({ irPara }: { irPara: (t: TelaVisitante) => void }) {
  const { estado, despachar } = useLoja();
  const [f, setF] = useState<FormChamado>(CHAMADO_VAZIO);
  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    },
    [],
  );
  const mudar = (campo: keyof FormChamado, valor: string) => {
    setF((x) => ({ ...x, [campo]: valor }));
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: '' }));
  };

  const enviar = () => {
    const e = soComMensagem({
      nome: validarNome(f.nome),
      email: validarEmail(f.email),
      telefone: validarTelefone(f.telefone),
      categoria: validarObrigatorio(f.categoria, 'Selecione a categoria.'),
      assunto: f.assunto.trim().length >= 5 ? null : 'Informe o assunto (mínimo 5 caracteres).',
      descricao: validarTexto10(f.descricao),
    });
    setErros(e);
    if (Object.keys(e).length) {
      focarPrimeiroErro(['nome', 'email', 'telefone', 'categoria', 'espaco', 'assunto', 'descricao'], e);
      return;
    }
    setEnviando(true);
    timer.current = window.setTimeout(() => {
      const solicitante = estado.solicitantes.find((s) => s.email === emailNorm(f.email));
      despachar({
        tipo: 'chamado/criar',
        dados: {
          nome: f.nome.trim(),
          email: f.email,
          telefone: f.telefone,
          empresa: solicitante ? solicitante.empresa : '',
          categoria: f.categoria,
          espacoId: f.espaco && f.espaco !== 'outro' ? f.espaco : null,
          assunto: f.assunto.trim(),
          descricao: f.descricao.trim(),
        },
      });
      irPara('chamadoOk');
    }, 600);
  };

  const exemplo = () => {
    setErros({});
    setF({
      nome: 'Rafael Souza',
      email: 'rafael@startupbeta.com',
      telefone: '(48) 98888-1111',
      categoria: 'Infraestrutura / equipamentos',
      espaco: 'esp-men',
      assunto: 'Wi-Fi instável na Sala Mentoria',
      descricao: 'A conexão cai a cada poucos minutos durante reuniões por vídeo.',
    });
  };

  return (
    <Pagina titulo="Abrir chamado" subtitulo="Conte o que aconteceu. O Gestor encaminha ao prestador certo e você acompanha o status por e-mail.">
      <div className="mx-auto max-w-3xl">
        <form
          className="ip-card flex flex-col gap-5 p-4 sm:p-6"
          noValidate
          onSubmit={(ev: React.FormEvent<HTMLFormElement>) => {
            ev.preventDefault();
            enviar();
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="ip-h2">Dados do chamado</h2>
            <Botao variante="fantasma" pequeno onClick={exemplo}>
              Preencher com exemplo
            </Botao>
          </div>
          <CampoTexto id="nome" rotulo="Nome completo" valor={f.nome} onMudar={(v) => mudar('nome', v)} erro={erros.nome} autoComplete="name" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <CampoTexto id="email" rotulo="E-mail" tipo="email" valor={f.email} onMudar={(v) => mudar('email', v)} erro={erros.email} placeholder="nome@empresa.com.br" autoComplete="email" />
            <CampoTexto id="telefone" rotulo="Telefone" valor={f.telefone} onMudar={(v) => mudar('telefone', v)} mascara={formatarTelefone} erro={erros.telefone} placeholder="(48) 99999-0000" inputMode="tel" autoComplete="tel" />
            <CampoSelect id="categoria" rotulo="Categoria" valor={f.categoria} onMudar={(v) => mudar('categoria', v)} opcoes={CATEGORIAS_CHAMADO} vazio="Selecione" erro={erros.categoria} />
            <CampoSelect
              id="espaco"
              rotulo="Espaço relacionado"
              valor={f.espaco}
              onMudar={(v) => mudar('espaco', v)}
              opcoes={[...estado.espacos.map((x) => ({ valor: x.id, rotulo: x.nome })), { valor: 'outro', rotulo: 'Outro / área comum' }]}
              vazio="Não se aplica"
            />
          </div>
          <CampoTexto id="assunto" rotulo="Assunto" valor={f.assunto} onMudar={(v) => mudar('assunto', v)} erro={erros.assunto} maxLength={120} />
          <CampoTextarea id="descricao" rotulo="Descrição" valor={f.descricao} onMudar={(v) => mudar('descricao', v)} erro={erros.descricao} placeholder="Descreva o problema com o máximo de detalhes" linhas={4} />
          <div className="flex flex-wrap justify-end gap-3">
            <Botao variante="secundario" onClick={() => irPara('home')} desabilitado={enviando}>
              <ArrowLeft size={16} aria-hidden="true" />
              Voltar
            </Botao>
            <Botao tipo="submit" carregando={enviando}>
              Enviar chamado
            </Botao>
          </div>
        </form>
      </div>
    </Pagina>
  );
}

/* ── V7 · Chamado registrado ────────────────────────────────────────────────── */

function ChamadoConfirmacao({ irPara }: { irPara: (t: TelaVisitante) => void }) {
  const { estado } = useLoja();
  const c = estado.chamados.find((x) => x.numero === estado.ultimo.chamado);
  if (!c) return <Pagina titulo="Chamado">Nenhum chamado recente. <Botao onClick={() => irPara('home')}>Voltar ao início</Botao></Pagina>;
  return (
    <Confirmacao
      titulo={`Chamado #${c.numero} aberto`}
      tag={<TagStatus status="Aberto" />}
      linhas={[]}
      texto={`Registramos seu chamado sobre «${c.assunto}». Você será avisado por e-mail (${c.email}) a cada mudança de status.`}
      acoes={<Botao onClick={() => irPara('home')}>Voltar ao início</Botao>}
    />
  );
}

/* ── Roteador do Visitante ──────────────────────────────────────────────────── */

function AreaVisitante({
  tela,
  irPara,
  rascunho,
  setRascunho,
  reiniciarRascunho,
}: {
  tela: TelaVisitante;
  irPara: (t: TelaVisitante) => void;
  rascunho: RascunhoReserva;
  setRascunho: (f: (r: RascunhoReserva) => RascunhoReserva) => void;
  reiniciarRascunho: () => void;
}) {
  switch (tela) {
    case 'reserva1':
      return <ReservaPasso1 rascunho={rascunho} setRascunho={setRascunho} irPara={irPara} />;
    case 'reserva2':
      return <ReservaPasso2 rascunho={rascunho} setRascunho={setRascunho} irPara={irPara} />;
    case 'reserva3':
      return (
        <ReservaConfirmacao
          irPara={irPara}
          novaReserva={() => {
            reiniciarRascunho();
            irPara('reserva1');
          }}
        />
      );
    case 'visita':
      return <VisitaForm irPara={irPara} />;
    case 'visitaOk':
      return <VisitaConfirmacao irPara={irPara} />;
    case 'chamado':
      return <ChamadoForm irPara={irPara} />;
    case 'chamadoOk':
      return <ChamadoConfirmacao irPara={irPara} />;
    default:
      return <Home irPara={irPara} />;
  }
}


/* ═════════════════════════════════════════════════════════════════════════════
   7 · TELAS DO GESTOR (login restrito)
   G1 Login · G2 Fila de aprovação · G3 Espaços · G4 Agenda de visitas ·
   G5 Solicitantes · G6 Relatórios · Central de chamados (pedido no briefing)
   ═════════════════════════════════════════════════════════════════════════════ */

type AbaGestor = 'fila' | 'espacos' | 'visitas' | 'solicitantes' | 'relatorios' | 'chamados';
const ABAS_GESTOR: { id: AbaGestor; rotulo: string }[] = [
  { id: 'fila', rotulo: 'Fila de aprovação' },
  { id: 'espacos', rotulo: 'Espaços' },
  { id: 'visitas', rotulo: 'Visitas técnicas' },
  { id: 'solicitantes', rotulo: 'Solicitantes' },
  { id: 'relatorios', rotulo: 'Relatórios' },
  { id: 'chamados', rotulo: 'Chamados' },
];

interface AvisoAcao {
  tom: Tom;
  titulo: string;
  texto: string;
}
function AvisoDaAcao({ aviso, fechar }: { aviso: AvisoAcao | null; fechar: () => void }) {
  if (!aviso) return null;
  return (
    <Alerta tom={aviso.tom} titulo={aviso.titulo} onFechar={fechar} className="mb-6">
      {aviso.texto}
    </Alerta>
  );
}

/* ── G1 / P0 · Login ────────────────────────────────────────────────────────── */

function LoginCard({
  perfil,
  titulo,
  subtitulo,
  contas,
  onSucesso,
}: {
  perfil: 'gestor' | 'prestador';
  titulo: string;
  subtitulo: string;
  contas: { rotulo: string; email: string; senha: string }[];
  onSucesso: () => void;
}) {
  const { despachar } = useLoja();
  const [email, setEmail] = useState(contas[0].email);
  const [senha, setSenha] = useState(contas[0].senha);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.focus({ preventScroll: true });
    return () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    };
  }, []);

  const entrar = () => {
    setErro(null);
    setEnviando(true);
    timer.current = window.setTimeout(() => {
      const r = autenticar(perfil, email, senha);
      setEnviando(false);
      if (!r.ok) {
        setErro('E-mail ou senha incorretos.');
        return;
      }
      despachar({ tipo: 'sessao/entrar', perfil, prestadorId: r.prestadorId });
      onSucesso();
    }, 450);
  };

  return (
    <div className="ip-gutter">
      <div className="ip-wrap py-8 sm:py-16">
        <form
          noValidate
          className="ip-card ip-card-lg mx-auto flex w-full max-w-md flex-col gap-4 p-6 sm:p-9"
          onSubmit={(ev: React.FormEvent<HTMLFormElement>) => {
            ev.preventDefault();
            entrar();
          }}
        >
          <div>
            <h1 ref={ref} tabIndex={-1} className="ip-h1">
              {titulo}
            </h1>
            <p className="mt-1.5 text-sm text-ip-muted">{subtitulo}</p>
          </div>
          {erro && (
            <Alerta tom="erro" titulo="Não foi possível entrar">
              {erro}
            </Alerta>
          )}
          <CampoTexto id="login-email" rotulo="E-mail" tipo="email" valor={email} onMudar={setEmail} autoComplete="username" />
          <CampoTexto id="login-senha" rotulo="Senha" tipo="password" valor={senha} onMudar={setSenha} autoComplete="current-password" />
          <Botao tipo="submit" bloco carregando={enviando} textoCarregando="Entrando…">
            Entrar
          </Botao>
          <div className="ip-caixa">
            <p className="text-xs font-semibold">Demonstração</p>
            <p className="ip-t13 mt-1 text-ip-muted">As credenciais já vêm preenchidas; não há autenticação de verdade neste protótipo.</p>
            {contas.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {contas.map((c) => (
                  <Chip
                    key={c.email}
                    ativo={email === c.email}
                    onClick={() => {
                      setEmail(c.email);
                      setSenha(c.senha);
                      setErro(null);
                    }}
                  >
                    {c.rotulo}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function GestorLogin({ onSucesso }: { onSucesso: () => void }) {
  return (
    <LoginCard
      perfil="gestor"
      titulo="Área do gestor"
      subtitulo="Acesso restrito ao perfil Gestor do Hub."
      contas={CONTAS_DEMO.gestor.map((c) => ({ rotulo: c.nome, email: c.email, senha: c.senha }))}
      onSucesso={onSucesso}
    />
  );
}

/* ── Modais compartilhados ──────────────────────────────────────────────────── */

/** G2c–h e G4c–h: recusa com justificativa obrigatória. */
function ModalRecusa({
  aberto,
  titulo,
  linha1,
  linha2,
  motivos,
  nota,
  sugerido,
  onConfirmar,
  onFechar,
}: {
  aberto: boolean;
  titulo: string;
  linha1: string;
  linha2: string;
  motivos: { rotulo: string; texto: string }[];
  nota: string;
  sugerido?: { rotulo: string; texto: string };
  onConfirmar: (justificativa: string) => void;
  onFechar: () => void;
}) {
  const [texto, setTexto] = useState('');
  const [motivo, setMotivo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (!aberto) return;
    setTexto(sugerido ? sugerido.texto : '');
    setMotivo(sugerido ? sugerido.rotulo : null);
    setErro(null);
  }, [aberto]);

  const confirmar = () => {
    const e = texto.trim().length >= 10 ? null : 'Informe a justificativa da recusa (mínimo 10 caracteres).';
    setErro(e);
    if (!e) onConfirmar(texto.trim());
  };

  return (
    <Modal aberto={aberto} titulo={titulo} onFechar={onFechar} idTitulo="modal-recusa-titulo">
      <div className="ip-caixa">
        <p className="text-sm font-semibold">{linha1}</p>
        <p className="ip-t13 mt-1 text-ip-muted">{linha2}</p>
      </div>
      <p className="mt-5 text-xs font-medium text-ip-muted">Motivos frequentes</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {motivos.map((m) => (
          <Chip
            key={m.rotulo}
            ativo={motivo === m.rotulo}
            onClick={() => {
              setMotivo(m.rotulo);
              setTexto(m.texto);
              setErro(null);
            }}
          >
            {m.rotulo}
          </Chip>
        ))}
      </div>
      <CampoTextarea
        id="justificativa"
        rotulo="Justificativa (obrigatória)"
        valor={texto}
        onMudar={(v) => {
          setTexto(v);
          if (erro) setErro(null);
        }}
        erro={erro}
        linhas={4}
        className="mt-5"
      />
      <p className="ip-t13 mt-3 text-ip-muted">{nota}</p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Botao variante="secundario" onClick={onFechar}>
          Cancelar
        </Botao>
        <Botao onClick={confirmar}>Confirmar recusa</Botao>
      </div>
    </Modal>
  );
}

function ModalHistorico({ aberto, titulo, tipoRef, refId, onFechar }: { aberto: boolean; titulo: string; tipoRef: RefHistorico; refId: string; onFechar: () => void }) {
  const { estado } = useLoja();
  const itens = estado.historico.filter((h) => h.ref === tipoRef && h.refId === refId).sort((a, b) => a.quando.localeCompare(b.quando) || a.id.localeCompare(b.id));
  return (
    <Modal aberto={aberto} titulo={titulo} onFechar={onFechar} largura={560} idTitulo="modal-historico-titulo">
      <ListaHistorico itens={itens} />
      <p className="ip-t13 mt-5 text-ip-muted">O histórico é mantido por, no mínimo, 12 meses.</p>
      <div className="mt-5 flex justify-end">
        <Botao variante="secundario" onClick={onFechar}>
          Fechar
        </Botao>
      </div>
    </Modal>
  );
}

/** P2: formulário de atendimento — novo status + observação. */
function ModalStatus({
  chamado,
  onConfirmar,
  onFechar,
}: {
  chamado: Chamado | null;
  onConfirmar: (status: StatusChamado, nota: string) => void;
  onFechar: () => void;
}) {
  const proximo = (s: StatusChamado): StatusChamado => {
    const i = STATUS_CHAMADO.indexOf(s);
    return STATUS_CHAMADO[Math.min(i + 1, STATUS_CHAMADO.length - 1)];
  };
  const [status, setStatus] = useState<StatusChamado>('Em andamento');
  const [nota, setNota] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const numero = chamado ? chamado.numero : null;
  useEffect(() => {
    if (chamado) {
      setStatus(proximo(chamado.status));
      setNota('');
      setErro(null);
    }
  }, [numero]);

  const salvar = () => {
    if (!chamado) return;
    if (status === chamado.status) {
      setErro('Escolha um status diferente do atual.');
      return;
    }
    onConfirmar(status, nota.trim());
  };

  return (
    <Modal aberto={chamado !== null} titulo="Atualizar status do chamado" onFechar={onFechar} idTitulo="modal-status-titulo">
      {chamado && (
        <div>
          <div className="ip-caixa">
            <p className="text-sm font-semibold">
              #{chamado.numero} · {chamado.assunto}
            </p>
            <p className="ip-t13 mt-1 text-ip-muted">
              {chamado.nome}
              {chamado.empresa ? ` · ${chamado.empresa}` : ''} · status atual: {chamado.status}
            </p>
          </div>
          <p className="mt-5 text-xs font-medium text-ip-muted" id="novo-status-rotulo">
            Novo status
          </p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="novo-status-rotulo">
            {STATUS_CHAMADO.map((s) => (
              <Chip
                key={s}
                ativo={status === s}
                onClick={() => {
                  setStatus(s);
                  setErro(null);
                }}
              >
                {s}
              </Chip>
            ))}
          </div>
          {erro && <p className="mt-2 text-xs font-medium text-ip-bad">{erro}</p>}
          <CampoTextarea id="observacao" rotulo="Observação" valor={nota} onMudar={setNota} linhas={3} placeholder="Descreva o atendimento (opcional)" className="mt-5" />
          <p className="ip-t13 mt-3 text-ip-muted">A mudança de status fica registrada no histórico do chamado.</p>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Botao variante="secundario" onClick={onFechar}>
              Cancelar
            </Botao>
            <Botao onClick={salvar}>Salvar status</Botao>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Detalhes + histórico de um chamado (Gestor e Prestador). */
function ModalChamado({ chamado, onFechar }: { chamado: Chamado | null; onFechar: () => void }) {
  const { estado } = useLoja();
  const itens = chamado
    ? estado.historico.filter((h) => h.ref === 'chamado' && h.refId === String(chamado.numero)).sort((a, b) => a.quando.localeCompare(b.quando) || a.id.localeCompare(b.id))
    : [];
  return (
    <Modal aberto={chamado !== null} titulo={chamado ? `Chamado #${chamado.numero}` : 'Chamado'} onFechar={onFechar} largura={640} idTitulo="modal-chamado-titulo">
      {chamado && (
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-base font-bold">{chamado.assunto}</p>
              <TagStatus status={chamado.status} />
            </div>
            <p className="mt-2 text-sm text-ip-muted">{chamado.descricao}</p>
          </div>
          <dl className="ip-caixa grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {[
              ['Solicitante', `${chamado.nome}${chamado.empresa ? ` · ${chamado.empresa}` : ''}`],
              ['Contato', `${chamado.email} · ${formatarTelefone(chamado.telefone)}`],
              ['Categoria', chamado.categoria],
              ['Espaço', nomeDoEspaco(estado, chamado.espacoId)],
              ['Aberto em', fmtData(chamado.abertoEm)],
              ['Prestador', nomeDoPrestador(chamado.prestadorId)],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-xs font-medium text-ip-muted">{k}</dt>
                <dd className="break-words text-sm font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          <div>
            <h3 className="ip-h2 mb-3">Histórico</h3>
            <ListaHistorico itens={itens} />
          </div>
          <div className="flex justify-end">
            <Botao variante="secundario" onClick={onFechar}>
              Fechar
            </Botao>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ── G2 · Fila de aprovação ─────────────────────────────────────────────────── */

function GestorFila() {
  const { estado, despachar } = useLoja();
  const [aviso, mostrar] = useAvisoTemporario<AvisoAcao>();
  const [recusando, setRecusando] = useState<Reserva | null>(null);
  const [verHistorico, setVerHistorico] = useState<Reserva | null>(null);
  const [visao, setVisao] = useState<'fila' | 'todas'>('fila');

  const pendentes = estado.reservas.filter((r) => r.status === 'Pendente').length;
  const ativos = estado.espacos.filter((x) => x.ativo).length;
  const lista = useMemo(() => {
    const base = visao === 'todas' ? estado.reservas : estado.reservas.filter((r) => r.status === 'Pendente' || r.confirmadaNaSessao || r.status === 'Recusada');
    return [...base].sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio));
  }, [estado.reservas, visao]);

  const aprovar = (r: Reserva) => {
    const nome = nomeDoEspaco(estado, r.espacoId);
    // Revalida o conflito na aprovação: a faixa pode ter sido ocupada por uma reserva confirmada depois do pedido.
    const bloco = temConflito(estado, { espacoId: r.espacoId, data: r.data, inicio: r.inicio, fim: r.fim }, { ignorarId: r.id, somenteConfirmados: true });
    if (bloco) {
      mostrar({
        tom: 'erro',
        titulo: 'Conflito de horário',
        texto: `A ${nome} já tem ${bloco.origem === 'reuniao' ? 'uma reunião interna' : 'uma reserva confirmada'} nesta faixa. Recuse esta solicitação.`,
      });
      return;
    }
    despachar({ tipo: 'reserva/decidir', id: r.id, decisao: 'Confirmada' });
    mostrar({
      tom: 'ok',
      titulo: 'Reserva confirmada',
      texto: `A ${nome} foi reservada para ${fmtData(r.data)}, ${faixa(r.inicio, r.fim)}. O solicitante será avisado por e-mail.`,
    });
  };

  const recusar = (justificativa: string) => {
    if (!recusando) return;
    const nome = nomeDoEspaco(estado, recusando.espacoId);
    despachar({ tipo: 'reserva/decidir', id: recusando.id, decisao: 'Recusada', motivo: justificativa });
    mostrar({ tom: 'erro', titulo: 'Solicitação recusada', texto: `A reserva da ${nome} foi recusada. O solicitante receberá a justificativa por e-mail.` });
    setRecusando(null);
  };

  const esp = recusando ? estado.espacos.find((x) => x.id === recusando.espacoId) : undefined;
  const sugerido =
    recusando && esp && acimaDaCapacidade(esp, recusando.participantes)
      ? {
          rotulo: 'Capacidade insuficiente',
          texto: `Capacidade insuficiente: a ${esp.nome} comporta até ${esp.capacidade} pessoas e a solicitação é para ${recusando.participantes} participantes.`,
        }
      : undefined;

  return (
    <Pagina titulo="Fila de aprovação" subtitulo="Reservas e visitas aguardando decisão do Gestor do Hub. Só chegam aqui solicitações sem conflito de horário.">
      <AvisoDaAcao aviso={aviso} fechar={() => mostrar(null)} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Indicador rotulo="Pendentes" valor={pendentes} />
        <Indicador rotulo="Confirmadas no mês" valor={confirmadasNoMes(estado)} />
        <Indicador rotulo="Espaços ativos" valor={ativos} />
      </div>

      <div className="mb-4 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="ip-h2">Reservas de espaço</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Exibir">
          <Chip ativo={visao === 'fila'} onClick={() => setVisao('fila')}>
            Fila e decisões de hoje
          </Chip>
          <Chip ativo={visao === 'todas'} onClick={() => setVisao('todas')}>
            Todas as reservas
          </Chip>
        </div>
      </div>

      {lista.length === 0 ? (
        <EstadoVazio titulo="Nenhuma solicitação pendente" texto="Quando alguém pedir um espaço, a reserva aparece aqui para decisão." />
      ) : (
        <ul className="flex flex-col gap-3">
          {lista.map((r) => {
            const e = estado.espacos.find((x) => x.id === r.espacoId);
            const acima = acimaDaCapacidade(e, r.participantes);
            return (
              <li key={r.id}>
                <article className="ip-card p-4 sm:p-5" aria-label={`Reserva ${r.id}`}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
                    <div className="min-w-0 lg:w-56 lg:shrink-0">
                      <h3 className="text-base font-bold">{e ? e.nome : 'Espaço removido'}</h3>
                      <p className="ip-t13 mt-0.5 text-ip-muted">Capacidade: {e ? e.capacidade : '—'} pessoas</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{r.nome}</p>
                      <p className="ip-t13 mt-0.5 text-ip-muted">
                        {empresaOuVisitante(r.empresa)} · {r.tipo}
                      </p>
                      <p className="ip-t13 mt-1">{r.finalidade}</p>
                    </div>
                    <div className="lg:w-60 lg:shrink-0">
                      <p className="text-sm font-semibold">{fmtData(r.data)}</p>
                      <p className="ip-t13 mt-0.5 text-ip-muted">{faixa(r.inicio, r.fim)}</p>
                      <p className={`ip-t13 mt-0.5 ${acima ? 'font-medium text-ip-warn' : 'text-ip-muted'}`}>
                        {r.participantes} participantes{acima ? ' (acima da capacidade)' : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
                      {r.status === 'Pendente' ? (
                        <>
                          <Botao variante="secundario" onClick={() => setRecusando(r)} ariaLabel={`Recusar reserva de ${r.nome}`}>
                            Recusar
                          </Botao>
                          <Botao onClick={() => aprovar(r)} ariaLabel={`Aprovar reserva de ${r.nome}`}>
                            Aprovar
                          </Botao>
                        </>
                      ) : (
                        <>
                          <TagStatus status={r.status} />
                          <Botao variante="fantasma" pequeno onClick={() => setVerHistorico(r)} ariaLabel={`Histórico da reserva ${r.id}`}>
                            <History size={16} aria-hidden="true" />
                            Histórico
                          </Botao>
                        </>
                      )}
                    </div>
                  </div>
                  {r.status === 'Recusada' && r.motivoRecusa && <p className="ip-t13 mt-3 text-ip-bad">Justificativa: {r.motivoRecusa}</p>}
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <ModalRecusa
        aberto={recusando !== null}
        titulo="Recusar solicitação"
        linha1={recusando ? `${nomeDoEspaco(estado, recusando.espacoId)} · ${fmtData(recusando.data)}, ${faixa(recusando.inicio, recusando.fim)}` : ''}
        linha2={recusando ? `${recusando.nome} · ${empresaOuVisitante(recusando.empresa)} · ${recusando.participantes} participantes` : ''}
        motivos={MOTIVOS_RESERVA}
        nota="O texto será enviado ao solicitante e fica registrado no histórico da reserva."
        sugerido={sugerido}
        onConfirmar={recusar}
        onFechar={() => setRecusando(null)}
      />
      <ModalHistorico aberto={verHistorico !== null} titulo={verHistorico ? `Histórico da reserva ${verHistorico.id}` : 'Histórico'} tipoRef="reserva" refId={verHistorico ? verHistorico.id : ''} onFechar={() => setVerHistorico(null)} />
    </Pagina>
  );
}

/* ── G3 · Cadastro de espaço ────────────────────────────────────────────────── */

interface FormEspaco {
  nome: string;
  tipo: string;
  capacidade: string;
  descricao: string;
  recursos: string[];
  ativo: boolean;
  fotos: string[];
}

function EspacoFormulario({ espaco, onCancelar, onSalvo }: { espaco: Espaco | null; onCancelar: () => void; onSalvo: (nome: string, novo: boolean) => void }) {
  const { estado, despachar } = useLoja();
  const [f, setF] = useState<FormEspaco>(
    espaco
      ? { nome: espaco.nome, tipo: espaco.tipo, capacidade: String(espaco.capacidade), descricao: espaco.descricao, recursos: espaco.recursos, ativo: espaco.ativo, fotos: espaco.fotos }
      : { nome: '', tipo: '', capacidade: '', descricao: '', recursos: [], ativo: true, fotos: [] },
  );
  const [erros, setErros] = useState<Erros>({});
  const entrada = useRef<HTMLInputElement>(null);

  const mudar = <K extends keyof FormEspaco>(campo: K, valor: FormEspaco[K]) => {
    setF((x) => ({ ...x, [campo]: valor }));
    if (erros[campo as string]) setErros((e) => ({ ...e, [campo as string]: '' }));
  };
  const alternarRecurso = (r: string) => mudar('recursos', f.recursos.includes(r) ? f.recursos.filter((x) => x !== r) : [...f.recursos, r]);
  const adicionarArquivos = (lista: FileList | null) => {
    if (!lista || lista.length === 0) return;
    const nomes = Array.from(lista).map((a) => a.name);
    mudar('fotos', [...f.fotos, ...nomes].slice(0, 6));
  };

  const salvar = () => {
    const nome = f.nome.trim();
    const cap = Number(f.capacidade);
    const duplicado = estado.espacos.some((x) => x.id !== (espaco ? espaco.id : '') && x.nome.trim().toLowerCase() === nome.toLowerCase());
    const e = soComMensagem({
      nome: !nome ? 'Informe o nome do espaço.' : duplicado ? 'Já existe um espaço com este nome.' : null,
      tipo: validarObrigatorio(f.tipo, 'Selecione o tipo do espaço.'),
      capacidade: /^\d+$/.test(f.capacidade.trim()) && cap >= 1 && cap <= 1000 ? null : 'Informe a capacidade (de 1 a 1000).',
    });
    setErros(e);
    if (Object.keys(e).length) {
      focarPrimeiroErro(['nome', 'tipo', 'capacidade'], e);
      return;
    }
    const arte: Arte = f.tipo === 'Auditório' ? 'auditorio' : f.tipo === 'Sala de mentoria' ? 'mentoria' : f.tipo === 'Sala de reuniões' ? 'sala' : 'generico';
    despachar({
      tipo: 'espaco/salvar',
      espaco: {
        id: espaco ? espaco.id : undefined,
        nome,
        tipo: f.tipo,
        capacidade: cap,
        descricao: f.descricao.trim(),
        recursos: f.recursos,
        ativo: f.ativo,
        arte: espaco ? espaco.arte : arte,
        foto: espaco ? espaco.foto : undefined,
        fotos: f.fotos,
      },
    });
    onSalvo(nome, !espaco);
  };

  const tipos = TIPOS_ESPACO.includes(f.tipo) || !f.tipo ? TIPOS_ESPACO : [...TIPOS_ESPACO, f.tipo];

  return (
    <Pagina titulo={espaco ? 'Editar espaço físico' : 'Cadastrar espaço físico'} subtitulo="Informe os dados do espaço. Ele só recebe reservas enquanto estiver ativo.">
      <form
        noValidate
        className="ip-card flex flex-col gap-6 p-4 sm:p-6"
        onSubmit={(ev: React.FormEvent<HTMLFormElement>) => {
          ev.preventDefault();
          salvar();
        }}
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <CampoTexto id="nome" rotulo="Nome do espaço" valor={f.nome} onMudar={(v) => mudar('nome', v)} erro={erros.nome} />
          <CampoSelect id="tipo" rotulo="Tipo" valor={f.tipo} onMudar={(v) => mudar('tipo', v)} opcoes={tipos} vazio="Selecione" erro={erros.tipo} />
          <CampoTexto id="capacidade" rotulo="Capacidade máxima" valor={f.capacidade} onMudar={(v) => mudar('capacidade', v.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" erro={erros.capacidade} />
        </div>
        <CampoTextarea id="descricao" rotulo="Descrição" valor={f.descricao} onMudar={(v) => mudar('descricao', v)} linhas={3} />

        <div>
          <p className="mb-1.5 text-xs font-medium text-ip-muted" id="fotos-rotulo">
            Fotos
          </p>
          <div
            className="ip-dropzone"
            aria-labelledby="fotos-rotulo"
            onDragOver={(ev: { preventDefault: () => void }) => ev.preventDefault()}
            onDrop={(ev: { preventDefault: () => void; dataTransfer: DataTransfer }) => {
              ev.preventDefault();
              adicionarArquivos(ev.dataTransfer.files);
            }}
          >
            <Upload size={22} className="text-ip-muted" aria-hidden="true" />
            <p className="text-sm text-ip-muted">Arraste as fotos aqui ou selecione do computador</p>
            <input
              ref={entrada}
              id="fotos-arquivos"
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-label="Selecionar arquivos de foto"
              onChange={(ev: React.ChangeEvent<HTMLInputElement>) => {
                adicionarArquivos(ev.target.files);
                ev.target.value = '';
              }}
            />
            <Botao variante="secundario" onClick={() => entrada.current?.click()}>
              Selecionar fotos
            </Botao>
            {f.fotos.length > 0 && (
              <ul className="flex flex-wrap justify-center gap-2" aria-label="Fotos selecionadas">
                {f.fotos.map((n, i) => (
                  <li key={`${n}-${i}`} className="ip-tag ip-tag-info">
                    {n}
                    <button type="button" className="ml-1 inline-flex border-0 bg-transparent p-0 text-ip-primary" aria-label={`Remover ${n}`} onClick={() => mudar('fotos', f.fotos.filter((_, j) => j !== i))}>
                      <X size={12} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-ip-muted" id="recursos-rotulo">
            Equipamentos e recursos
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="recursos-rotulo">
            {[...RECURSOS_ESPACO, ...f.recursos.filter((r) => !RECURSOS_ESPACO.includes(r))].map((r) => (
              <Chip key={r} ativo={f.recursos.includes(r)} onClick={() => alternarRecurso(r)}>
                {f.recursos.includes(r) ? '✓' : '+'} {r}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Interruptor id="espaco-ativo" marcado={f.ativo} onMudar={(v) => mudar('ativo', v)} rotulo="Espaço ativo" />
          <label htmlFor="espaco-ativo" className="text-sm">
            Espaço ativo (inativar mantém o histórico para relatórios)
          </label>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Botao variante="secundario" onClick={onCancelar}>
            Cancelar
          </Botao>
          <Botao tipo="submit">Salvar espaço</Botao>
        </div>
      </form>
    </Pagina>
  );
}

function GestorEspacos() {
  const { estado, despachar } = useLoja();
  const [modo, setModo] = useState<'lista' | 'form'>('lista');
  const [editando, setEditando] = useState<Espaco | null>(null);
  const [aviso, mostrar] = useAvisoTemporario<AvisoAcao>();

  if (modo === 'form') {
    return (
      <EspacoFormulario
        espaco={editando}
        onCancelar={() => setModo('lista')}
        onSalvo={(nome, novo) => {
          setModo('lista');
          mostrar({ tom: 'ok', titulo: novo ? 'Espaço cadastrado' : 'Espaço atualizado', texto: `${nome} foi salvo.` });
        }}
      />
    );
  }

  const alternarAtivo = (x: Espaco) => {
    despachar({ tipo: 'espaco/ativo', id: x.id, ativo: !x.ativo });
    mostrar(
      x.ativo
        ? { tom: 'aviso', titulo: 'Espaço inativado', texto: `${x.nome} não recebe novas reservas; reservas e relatórios anteriores foram mantidos.` }
        : { tom: 'ok', titulo: 'Espaço ativado', texto: `${x.nome} volta a receber reservas.` },
    );
  };

  return (
    <Pagina
      titulo="Espaços"
      subtitulo="Cadastre e edite os espaços físicos do hub. Espaço inativo aparece como Indisponível e mantém o histórico."
      acao={
        <Botao
          onClick={() => {
            setEditando(null);
            setModo('form');
          }}
        >
          <Plus size={16} aria-hidden="true" />
          Cadastrar espaço
        </Botao>
      }
    >
      <AvisoDaAcao aviso={aviso} fechar={() => mostrar(null)} />
      <ul className="flex flex-col gap-3">
        {estado.espacos.map((x) => (
          <li key={x.id}>
            <article className="ip-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5" aria-label={x.nome}>
              <div className="ip-foto">
                <FotoEspaco espaco={x} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-lg font-bold">{x.nome}</h3>
                  <Tag tom={x.ativo ? 'ok' : 'neutro'}>{x.ativo ? 'Ativo' : 'Inativo'}</Tag>
                </div>
                <p className="ip-t13 mt-1 font-medium text-ip-muted">
                  Capacidade: {x.capacidade} pessoas · {x.tipo}
                </p>
                <p className="ip-t13 mt-1 text-ip-muted">{x.recursos.length ? x.recursos.join(' · ') : 'Sem recursos cadastrados'}</p>
                {x.descricao && <p className="ip-t13 mt-1">{x.descricao}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-4 sm:shrink-0">
                <div className="flex items-center gap-2">
                  <Interruptor id={`ativo-${x.id}`} marcado={x.ativo} onMudar={() => alternarAtivo(x)} rotulo={`Espaço ${x.nome} ativo`} />
                  <label htmlFor={`ativo-${x.id}`} className="text-sm">
                    Ativo
                  </label>
                </div>
                <Botao
                  variante="secundario"
                  onClick={() => {
                    setEditando(x);
                    setModo('form');
                  }}
                  ariaLabel={`Editar ${x.nome}`}
                >
                  <Pencil size={16} aria-hidden="true" />
                  Editar
                </Botao>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </Pagina>
  );
}

/* ── G4 · Agenda de visitas técnicas ────────────────────────────────────────── */

function GestorVisitas() {
  const { estado, despachar } = useLoja();
  const [aviso, mostrar] = useAvisoTemporario<AvisoAcao>();
  const [recusando, setRecusando] = useState<Visita | null>(null);
  const [verHistorico, setVerHistorico] = useState<Visita | null>(null);
  const [visao, setVisao] = useState<'fila' | 'todas'>('fila');
  const [semana, setSemana] = useState<string>(() => {
    const primeira = estado.visitas.filter((v) => v.status === 'Pendente').sort((a, b) => a.data.localeCompare(b.data))[0];
    return segundaDa(primeira ? primeira.data : hoje());
  });

  const lista = useMemo(() => {
    const base = visao === 'todas' ? estado.visitas : estado.visitas.filter((v) => v.status === 'Pendente' || v.confirmadaNaSessao || v.status === 'Recusada');
    return [...base].sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio));
  }, [estado.visitas, visao]);
  const agenda = useMemo(() => itensDaSemana(estado, semana), [estado.reunioes, estado.reservas, estado.visitas, estado.espacos, semana]);
  const nomeCurto = (v: Visita) => v.instituicao.split(' · ')[0];

  const aprovar = (v: Visita) => {
    const conflito = conflitoAgenda(estado, v);
    if (conflito) {
      mostrar({
        tom: 'erro',
        titulo: 'Conflito de agenda',
        texto: `A visita de ${v.instituicao} sobrepõe ${conflito.item} (${faixa(conflito.inicio, conflito.fim)}). Recuse a visita ou libere a agenda antes de aprovar.`,
      });
      return;
    }
    despachar({ tipo: 'visita/decidir', id: v.id, decisao: 'Confirmada' });
    setSemana(segundaDa(v.data));
    mostrar({
      tom: 'ok',
      titulo: 'Visita aprovada',
      texto: `A visita da ${nomeCurto(v)} (${fmtData(v.data)}, ${faixa(v.inicio, v.fim)}) foi adicionada à agenda, sem conflito com reuniões internas.`,
    });
  };

  const recusar = (justificativa: string) => {
    if (!recusando) return;
    despachar({ tipo: 'visita/decidir', id: recusando.id, decisao: 'Recusada', motivo: justificativa });
    mostrar({ tom: 'erro', titulo: 'Visita recusada', texto: `A visita de ${recusando.instituicao} foi recusada. O solicitante receberá a justificativa por e-mail.` });
    setRecusando(null);
  };

  return (
    <Pagina titulo="Agenda de visitas técnicas" subtitulo="Solicitações exigem antecedência mínima de 3 dias úteis. Ao aprovar, a visita entra na agenda ao lado.">
      <AvisoDaAcao aviso={aviso} fechar={() => mostrar(null)} />
      <div className="ip-cols">
        <section className="ip-main" aria-labelledby="h-visitas">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="h-visitas" className="ip-h2">
              Solicitações de visita
            </h2>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Exibir">
              <Chip ativo={visao === 'fila'} onClick={() => setVisao('fila')}>
                Fila e decisões de hoje
              </Chip>
              <Chip ativo={visao === 'todas'} onClick={() => setVisao('todas')}>
                Todas as visitas
              </Chip>
            </div>
          </div>
          {lista.length === 0 ? (
            <EstadoVazio titulo="Nenhuma visita pendente" texto="Os pedidos feitos pelo formulário de visita técnica aparecem aqui." />
          ) : (
            <ul className="flex flex-col gap-3">
              {lista.map((v) => (
                <li key={v.id}>
                  <article className="ip-card p-4 sm:p-5" aria-label={`Visita ${v.id}`}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold">{v.instituicao}</h3>
                        <p className="ip-t13 mt-0.5 text-ip-muted">{v.objetivo}</p>
                        <p className="ip-t13 mt-2 font-medium">
                          {fmtData(v.data)} · {faixa(v.inicio, v.fim)} · {plural(v.visitantes, 'visitante', 'visitantes')}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                        {v.status === 'Pendente' ? (
                          <>
                            <Botao variante="secundario" onClick={() => setRecusando(v)} ariaLabel={`Recusar visita de ${v.instituicao}`}>
                              Recusar
                            </Botao>
                            <Botao onClick={() => aprovar(v)} ariaLabel={`Aprovar visita de ${v.instituicao}`}>
                              Aprovar
                            </Botao>
                          </>
                        ) : (
                          <>
                            <TagStatus status={v.status} />
                            <Botao variante="fantasma" pequeno onClick={() => setVerHistorico(v)} ariaLabel={`Histórico da visita ${v.id}`}>
                              <History size={16} aria-hidden="true" />
                              Histórico
                            </Botao>
                          </>
                        )}
                      </div>
                    </div>
                    {v.status === 'Recusada' && v.motivoRecusa && <p className="ip-t13 mt-3 text-ip-bad">Justificativa: {v.motivoRecusa}</p>}
                  </article>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="ip-aside" aria-labelledby="h-agenda">
          <div className="ip-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 id="h-agenda" className="ip-h2">
                Agenda da semana ({tituloSemana(semana)})
              </h2>
              <div className="flex shrink-0">
                <button type="button" className="ip-iconbtn text-ip-muted" aria-label="Semana anterior" onClick={() => setSemana(somarDias(semana, -7))}>
                  <ChevronLeft size={18} />
                </button>
                <button type="button" className="ip-iconbtn text-ip-muted" aria-label="Próxima semana" onClick={() => setSemana(somarDias(semana, 7))}>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            {agenda.length === 0 ? (
              <p className="mt-4 text-sm text-ip-muted">Nenhum compromisso nesta semana.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {agenda.map((i) => (
                  <li key={i.id} className={`ip-agenda ip-agenda-${i.tipo} ${i.pendente ? 'ip-agenda-pendente' : ''}`}>
                    <p className="text-xs font-semibold text-ip-muted">
                      {DIAS_CURTOS[diaSemana(i.data)]} {fmtDataCurta(i.data)} · {faixa(i.inicio, i.fim)}
                    </p>
                    <p className="text-sm font-semibold">
                      {i.titulo}
                      {i.tipo !== 'reuniao' && i.pendente ? ' (pendente)' : ''}
                      {i.tipo === 'visita' && !i.pendente ? ' (confirmada)' : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="ip-t13 mt-4 text-ip-muted">Reuniões internas aparecem na agenda para evitar sobreposição com as visitas.</p>
          </div>
        </aside>
      </div>

      <ModalRecusa
        aberto={recusando !== null}
        titulo="Recusar visita técnica"
        linha1={recusando ? `${recusando.instituicao} · ${fmtData(recusando.data)}, ${faixa(recusando.inicio, recusando.fim)}` : ''}
        linha2={recusando ? `${plural(recusando.visitantes, 'visitante', 'visitantes')} · ${recusando.objetivo}` : ''}
        motivos={MOTIVOS_VISITA}
        nota="O texto será enviado ao solicitante e fica registrado no histórico da visita."
        onConfirmar={recusar}
        onFechar={() => setRecusando(null)}
      />
      <ModalHistorico aberto={verHistorico !== null} titulo={verHistorico ? `Histórico da visita ${verHistorico.id}` : 'Histórico'} tipoRef="visita" refId={verHistorico ? verHistorico.id : ''} onFechar={() => setVerHistorico(null)} />
    </Pagina>
  );
}

/* ── G5 · Solicitantes e empresas (+ G5b · Cadastrar solicitante) ───────────── */

interface FormSolicitante {
  nome: string;
  tipo: string;
  email: string;
  telefone: string;
  empresa: string;
}

function SolicitanteFormulario({ solicitante, onCancelar, onSalvo }: { solicitante: Solicitante | null; onCancelar: () => void; onSalvo: (nome: string, novo: boolean) => void }) {
  const { estado, despachar } = useLoja();
  const [f, setF] = useState<FormSolicitante>(
    solicitante
      ? { nome: solicitante.nome, tipo: solicitante.tipo, email: solicitante.email, telefone: formatarTelefone(solicitante.telefone), empresa: solicitante.empresa }
      : { nome: '', tipo: '', email: '', telefone: '', empresa: '' },
  );
  const [erros, setErros] = useState<Erros>({});
  const mudar = (campo: keyof FormSolicitante, valor: string) => {
    setF((x) => ({ ...x, [campo]: valor }));
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: '' }));
  };

  const salvar = () => {
    const email = emailNorm(f.email);
    const duplicado = estado.solicitantes.some((s) => s.id !== (solicitante ? solicitante.id : '') && s.email === email);
    const e = soComMensagem({
      nome: validarNome(f.nome),
      tipo: validarObrigatorio(f.tipo, 'Selecione o tipo de solicitante.'),
      email: validarEmail(f.email) ?? (duplicado ? 'Este e-mail já está cadastrado.' : null),
      telefone: validarTelefone(f.telefone),
    });
    setErros(e);
    if (Object.keys(e).length) {
      focarPrimeiroErro(['nome', 'tipo', 'email', 'telefone', 'empresa'], e);
      return;
    }
    despachar({
      tipo: 'solicitante/salvar',
      dados: { id: solicitante ? solicitante.id : undefined, nome: f.nome.trim(), tipo: f.tipo as TipoSolicitante, email, telefone: f.telefone, empresa: f.empresa.trim() },
    });
    onSalvo(f.nome.trim(), !solicitante);
  };

  return (
    <Pagina titulo={solicitante ? 'Editar solicitante' : 'Cadastrar solicitante'} subtitulo="Os dados de contato e a empresa vinculada permitem relacionar reservas e chamados.">
      <form
        noValidate
        className="ip-card flex flex-col gap-5 p-4 sm:p-6"
        onSubmit={(ev: React.FormEvent<HTMLFormElement>) => {
          ev.preventDefault();
          salvar();
        }}
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <CampoTexto id="nome" rotulo="Nome completo" valor={f.nome} onMudar={(v) => mudar('nome', v)} erro={erros.nome} />
          <CampoSelect id="tipo" rotulo="Tipo de solicitante" valor={f.tipo} onMudar={(v) => mudar('tipo', v)} opcoes={TIPOS_SOLICITANTE} vazio="Selecione" erro={erros.tipo} />
          <CampoTexto id="email" rotulo="E-mail" tipo="email" valor={f.email} onMudar={(v) => mudar('email', v)} erro={erros.email} placeholder="nome@empresa.com.br" />
          <CampoTexto id="telefone" rotulo="Telefone" valor={f.telefone} onMudar={(v) => mudar('telefone', v)} mascara={formatarTelefone} erro={erros.telefone} placeholder="(48) 99999-0000" inputMode="tel" />
          <CampoTexto id="empresa" rotulo="Empresa / Startup" valor={f.empresa} onMudar={(v) => mudar('empresa', v)} dica="Opcional para visitantes e instituições." />
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <Botao variante="secundario" onClick={onCancelar}>
            Cancelar
          </Botao>
          <Botao tipo="submit">Salvar solicitante</Botao>
        </div>
      </form>
    </Pagina>
  );
}

function GestorSolicitantes() {
  const { estado } = useLoja();
  const [modo, setModo] = useState<'lista' | 'form'>('lista');
  const [editando, setEditando] = useState<Solicitante | null>(null);
  const [busca, setBusca] = useState('');
  const [aviso, mostrar] = useAvisoTemporario<AvisoAcao>();

  if (modo === 'form') {
    return (
      <SolicitanteFormulario
        solicitante={editando}
        onCancelar={() => setModo('lista')}
        onSalvo={(nome, novo) => {
          setModo('lista');
          mostrar({ tom: 'ok', titulo: novo ? 'Solicitante cadastrado' : 'Solicitante atualizado', texto: `${nome} foi salvo.` });
        }}
      />
    );
  }

  const termo = busca.trim().toLowerCase();
  const lista = estado.solicitantes.filter((s) => !termo || `${s.nome} ${s.email} ${s.empresa}`.toLowerCase().includes(termo));

  return (
    <Pagina
      titulo="Solicitantes e empresas"
      subtitulo="Empreendedores, residentes, visitantes e instituições, vinculados à empresa/startup."
      acao={
        <Botao
          onClick={() => {
            setEditando(null);
            setModo('form');
          }}
        >
          <Plus size={16} aria-hidden="true" />
          Novo solicitante
        </Botao>
      }
    >
      <AvisoDaAcao aviso={aviso} fechar={() => mostrar(null)} />
      <CampoTexto id="busca-solicitante" rotulo="Buscar por nome, e-mail ou empresa" valor={busca} onMudar={setBusca} className="mb-4 max-w-md" />
      <div className="ip-card relative overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm" style={{ minWidth: 640 }}>
          <caption className="sr-only">Solicitantes cadastrados</caption>
          <thead>
            <tr className="border-b border-ip-line text-xs text-ip-muted">
              <th scope="col" className="px-4 py-3 font-semibold">
                Nome
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Tipo
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Empresa / Startup
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Contato
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lista.map((s) => (
              <tr key={s.id} className="border-b border-ip-line last:border-b-0">
                <td className="px-4 py-3 font-semibold">{s.nome}</td>
                <td className="px-4 py-3">{s.tipo}</td>
                <td className="px-4 py-3">{s.empresa || '—'}</td>
                <td className="px-4 py-3 text-ip-muted">
                  {s.email} · {formatarTelefone(s.telefone)}
                </td>
                <td className="px-4 py-2 text-right">
                  <Botao
                    variante="secundario"
                    pequeno
                    onClick={() => {
                      setEditando(s);
                      setModo('form');
                    }}
                    ariaLabel={`Editar ${s.nome}`}
                  >
                    Editar
                  </Botao>
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ip-muted">
                  Nenhum solicitante encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Pagina>
  );
}

/* ── G6 · Relatórios de uso ─────────────────────────────────────────────────── */

function GestorRelatorios() {
  const { estado } = useLoja();
  const mesAtual = hoje().slice(0, 7);
  const [filtro, setFiltro] = useState<FiltroRelatorio>({ de: mesAtual, ate: mesAtual, espacoId: 'todos' });
  const rotuloMes = (mes: string) => (BASE_RELATORIOS.meses.find((m) => m.mes === mes)?.rotulo ?? mes).replace('*', '');
  const opcoesMes = BASE_RELATORIOS.meses.map((m) => ({ valor: m.mes, rotulo: m.rotulo.replace('*', '') }));

  const rel = useMemo(() => calcularRelatorio(estado, filtro), [estado.reservas, estado.visitas, estado.chamados, estado.espacos, filtro]);
  const todos = useMemo(() => calcularRelatorio(estado, { de: '0000-00', ate: '9999-99', espacoId: 'todos' }), [estado.reservas, estado.visitas, estado.chamados, estado.espacos]);
  const maximo = Math.max(1, ...rel.ranking.map((x) => x.total));
  const periodo = filtro.de === filtro.ate ? rotuloMes(filtro.de) : `${rotuloMes(filtro.de)} a ${rotuloMes(filtro.ate)}`;

  const mudarDe = (v: string) => setFiltro((f) => ({ ...f, de: v, ate: f.ate < v ? v : f.ate }));
  const mudarAte = (v: string) => setFiltro((f) => ({ ...f, ate: v, de: f.de > v ? v : f.de }));

  return (
    <Pagina titulo="Relatórios de uso" subtitulo="Uso dos espaços e volume de reservas, visitas e chamados para embasar decisões. O histórico fica disponível por no mínimo 12 meses.">
      <section className="ip-card p-4 sm:p-5" aria-label="Filtros">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <CampoSelect id="rel-de" rotulo="Mês inicial" valor={filtro.de} onMudar={mudarDe} opcoes={opcoesMes} />
          <CampoSelect id="rel-ate" rotulo="Mês final" valor={filtro.ate} onMudar={mudarAte} opcoes={opcoesMes} />
          <CampoSelect id="rel-espaco" rotulo="Espaço" valor={filtro.espacoId} onMudar={(v) => setFiltro((f) => ({ ...f, espacoId: v }))} opcoes={[{ valor: 'todos', rotulo: 'Todos os espaços' }, ...estado.espacos.map((x) => ({ valor: x.id, rotulo: x.nome }))]} />
        </div>
      </section>

      <section className="mt-6" aria-labelledby="h-indicadores">
        <h2 id="h-indicadores" className="sr-only">
          Indicadores de {periodo}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Indicador rotulo="Reservas confirmadas" valor={rel.reservas} detalhe={periodo} />
          <Indicador rotulo="Visitas técnicas" valor={rel.visitas} detalhe={periodo} />
          <Indicador rotulo="Chamados abertos" valor={rel.chamados} detalhe={periodo} />
          <Indicador rotulo="Horas reservadas" valor={fmtHoras(rel.horas)} detalhe={periodo} />
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="ip-card p-4 sm:p-5" aria-labelledby="h-ranking">
          <h2 id="h-ranking" className="ip-h2">
            Espaços mais usados
          </h2>
          <p className="ip-t13 mt-1 text-ip-muted">Reservas confirmadas no período ({periodo})</p>
          <ul className="mt-4 flex flex-col gap-3">
            {rel.ranking.map((x) => (
              <li key={x.id} className="flex items-center gap-3" title={`${x.nome}: ${plural(x.total, 'reserva confirmada', 'reservas confirmadas')}`}>
                <span className="w-32 shrink-0 text-sm sm:w-40">{x.nome}</span>
                <span className="ip-bar-trilho" aria-hidden="true">
                  <span className="ip-bar block" style={{ width: `${(x.total / maximo) * 100}%` }} />
                </span>
                <span className="w-8 shrink-0 text-right text-sm font-semibold">{x.total}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="ip-card p-4 sm:p-5" aria-labelledby="h-volume">
          <h2 id="h-volume" className="ip-h2">
            Volume mensal
          </h2>
          <p className="ip-t13 mt-1 text-ip-muted">Solicitações por tipo</p>
          <div className="relative mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Solicitações por mês e tipo</caption>
              <thead>
                <tr className="border-b border-ip-line text-xs text-ip-muted">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Mês
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Reservas
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Visitas
                  </th>
                  <th scope="col" className="py-2 pl-3 text-right font-semibold">
                    Chamados
                  </th>
                </tr>
              </thead>
              <tbody>
                {todos.meses.map((m) => (
                  <tr key={m.mes} className={`border-b border-ip-line last:border-b-0 ${m.mes >= filtro.de && m.mes <= filtro.ate ? 'bg-ip-soft' : ''}`}>
                    <th scope="row" className="py-2.5 pr-3 pl-2 font-semibold">
                      {m.rotulo}
                    </th>
                    <td className="px-3 py-2.5 text-right">{m.reservas}</td>
                    <td className="px-3 py-2.5 text-right">{m.visitas}</td>
                    <td className="py-2.5 pl-3 pr-2 text-right">{m.chamados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ip-t13 mt-3 text-ip-muted">* até {fmtData(hoje())}. Linhas em destaque estão no período filtrado.</p>
        </section>
      </div>

      <p className="ip-t13 mt-6 text-ip-muted">
        Dados fictícios para demonstração, somados ao que acontece nesta sessão. No sistema, os números vêm das views vw_uso_espacos e vw_volume_mensal do banco.
      </p>
    </Pagina>
  );
}

/* ── Central de chamados (pedido no briefing; não existe no Figma) ──────────── */

function GestorChamados() {
  const { estado, despachar } = useLoja();
  const [filtro, setFiltro] = useState<'todos' | StatusChamado>('todos');
  const [aviso, mostrar] = useAvisoTemporario<AvisoAcao>();
  const [detalhe, setDetalhe] = useState<number | null>(null);
  const [alterando, setAlterando] = useState<number | null>(null);

  const lista = useMemo(
    () => [...estado.chamados].filter((c) => filtro === 'todos' || c.status === filtro).sort((a, b) => b.numero - a.numero),
    [estado.chamados, filtro],
  );
  const contagem = (s: StatusChamado) => estado.chamados.filter((c) => c.status === s).length;
  const doDetalhe = estado.chamados.find((c) => c.numero === detalhe) ?? null;
  const doStatus = estado.chamados.find((c) => c.numero === alterando) ?? null;

  const encaminhar = (c: Chamado, prestadorId: string) => {
    if (!prestadorId || prestadorId === c.prestadorId) return;
    despachar({ tipo: 'chamado/encaminhar', numero: c.numero, prestadorId });
    mostrar({ tom: 'ok', titulo: 'Chamado encaminhado', texto: `O chamado #${c.numero} foi encaminhado a ${nomeDoPrestador(prestadorId)}. Ele aparece em "Meus chamados" do prestador.` });
  };

  return (
    <Pagina titulo="Chamados" subtitulo="Central de chamados abertos pelos visitantes: filtre por status, encaminhe a um prestador, altere o status e consulte o histórico.">
      <AvisoDaAcao aviso={aviso} fechar={() => mostrar(null)} />
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filtrar por status">
        <Chip ativo={filtro === 'todos'} onClick={() => setFiltro('todos')}>
          Todos ({estado.chamados.length})
        </Chip>
        {STATUS_CHAMADO.map((s) => (
          <Chip key={s} ativo={filtro === s} onClick={() => setFiltro(s)}>
            {s} ({contagem(s)})
          </Chip>
        ))}
      </div>
      {lista.length === 0 ? (
        <EstadoVazio titulo="Nenhum chamado neste filtro" />
      ) : (
        <ul className="flex flex-col gap-3">
          {lista.map((c) => (
            <li key={c.numero}>
              <article className="ip-card p-4 sm:p-5" aria-label={`Chamado ${c.numero}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-base font-bold">
                        #{c.numero} · {c.assunto}
                      </h3>
                      <TagStatus status={c.status} />
                    </div>
                    <p className="ip-t13 mt-1 text-ip-muted">
                      {c.nome}
                      {c.empresa ? ` · ${c.empresa}` : ''} · {c.categoria} · {nomeDoEspaco(estado, c.espacoId)} · aberto em {fmtData(c.abertoEm)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                    <select
                      aria-label={`Encaminhar chamado ${c.numero} a um prestador`}
                      className="ip-input"
                      style={{ width: 'auto', minWidth: 220 }}
                      value={c.prestadorId ?? ''}
                      disabled={c.status === 'Fechado'}
                      onChange={(ev: React.ChangeEvent<HTMLSelectElement>) => encaminhar(c, ev.target.value)}
                    >
                      <option value="" disabled>
                        Encaminhar para…
                      </option>
                      {PRESTADORES.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome} · {p.area}
                        </option>
                      ))}
                    </select>
                    <Botao variante="secundario" onClick={() => setDetalhe(c.numero)} ariaLabel={`Detalhes do chamado ${c.numero}`}>
                      Detalhes
                    </Botao>
                    <Botao variante="secundario" onClick={() => setAlterando(c.numero)} ariaLabel={`Alterar status do chamado ${c.numero}`}>
                      Alterar status
                    </Botao>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
      <ModalStatus
        chamado={doStatus}
        onFechar={() => setAlterando(null)}
        onConfirmar={(status, nota) => {
          if (!doStatus) return;
          despachar({ tipo: 'chamado/status', numero: doStatus.numero, status, nota, autor: 'Gestor' });
          mostrar({ tom: 'ok', titulo: 'Status atualizado', texto: `O chamado #${doStatus.numero} agora está "${status}". O solicitante foi avisado por e-mail.` });
          setAlterando(null);
        }}
      />
      <ModalChamado chamado={doDetalhe} onFechar={() => setDetalhe(null)} />
    </Pagina>
  );
}

/* ── Roteador do Gestor ─────────────────────────────────────────────────────── */

function AreaGestor({ aba }: { aba: AbaGestor }) {
  switch (aba) {
    case 'espacos':
      return <GestorEspacos />;
    case 'visitas':
      return <GestorVisitas />;
    case 'solicitantes':
      return <GestorSolicitantes />;
    case 'relatorios':
      return <GestorRelatorios />;
    case 'chamados':
      return <GestorChamados />;
    default:
      return <GestorFila />;
  }
}


/* ═════════════════════════════════════════════════════════════════════════════
   8 · TELAS DO PRESTADOR (login restrito)
   P0 Login · P1 Meus chamados · P2 Atualizar status (ModalStatus) · P3 aviso
   O Prestador vê só os chamados encaminhados a ele pelo Gestor.
   ═════════════════════════════════════════════════════════════════════════════ */

function PrestadorLogin({ onSucesso }: { onSucesso: () => void }) {
  return (
    <LoginCard
      perfil="prestador"
      titulo="Acesso de prestadores"
      subtitulo="Entre para ver e atualizar os chamados encaminhados a você."
      contas={CONTAS_DEMO.prestador.map((c) => ({ rotulo: nomeDoPrestador(c.prestadorId), email: c.email, senha: c.senha }))}
      onSucesso={onSucesso}
    />
  );
}

/** Abertos primeiro; resolvidos e fechados no fim. */
const ORDEM_STATUS: Record<StatusChamado, number> = { Aberto: 0, 'Em andamento': 1, Resolvido: 2, Fechado: 3 };

/** P1 · lista "Meus chamados" + P2 (modal de atendimento) + P3 (aviso "Status atualizado"). */
function PrestadorChamados() {
  const { estado, despachar } = useLoja();
  const [aviso, mostrar] = useAvisoTemporario<AvisoAcao>();
  const [filtro, setFiltro] = useState<'todos' | StatusChamado>('todos');
  const [alterando, setAlterando] = useState<number | null>(null);
  const [detalhe, setDetalhe] = useState<number | null>(null);

  const meuId = estado.sessao.prestadorId;
  const prestador = PRESTADORES.find((p) => p.id === meuId);
  const meus = useMemo(() => estado.chamados.filter((c) => c.prestadorId === meuId), [estado.chamados, meuId]);
  const lista = useMemo(
    () => meus.filter((c) => filtro === 'todos' || c.status === filtro).sort((a, b) => ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status] || b.numero - a.numero),
    [meus, filtro],
  );
  const contagem = (s: StatusChamado) => meus.filter((c) => c.status === s).length;
  const doStatus = meus.find((c) => c.numero === alterando) ?? null;
  const doDetalhe = meus.find((c) => c.numero === detalhe) ?? null;

  return (
    <Pagina
      titulo="Meus chamados"
      subtitulo={`${prestador ? `${prestador.nome} · ${prestador.area}. ` : ''}Chamados encaminhados a você pelo Gestor do Hub. Atualize o status conforme o atendimento avança.`}
    >
      <AvisoDaAcao aviso={aviso} fechar={() => mostrar(null)} />

      {meus.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filtrar por status">
          <Chip ativo={filtro === 'todos'} onClick={() => setFiltro('todos')}>
            Todos ({meus.length})
          </Chip>
          {STATUS_CHAMADO.map((s) => (
            <Chip key={s} ativo={filtro === s} onClick={() => setFiltro(s)}>
              {s} ({contagem(s)})
            </Chip>
          ))}
        </div>
      )}

      {meus.length === 0 ? (
        <EstadoVazio titulo="Nenhum chamado encaminhado a você" texto="Quando o Gestor encaminhar um chamado, ele aparece aqui." />
      ) : lista.length === 0 ? (
        <EstadoVazio titulo="Nenhum chamado com este status" texto="Escolha outro filtro para ver os demais chamados." />
      ) : (
        <ul className="flex flex-col gap-3">
          {lista.map((c) => (
            <li key={c.numero}>
              <article className="ip-card p-4 sm:p-5" aria-label={`Chamado ${c.numero}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold">
                      #{c.numero} · {c.assunto}
                    </h3>
                    <p className="ip-t13 mt-0.5 text-ip-muted">
                      {c.nome} · {c.empresa || 'Sem empresa'}
                    </p>
                    <p className="ip-t13 mt-0.5 text-ip-muted">
                      Aberto em {fmtData(c.abertoEm)} · {nomeDoEspaco(estado, c.espacoId)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:shrink-0">
                    <TagStatus status={c.status} />
                    <Botao variante="fantasma" pequeno onClick={() => setDetalhe(c.numero)} ariaLabel={`Detalhes do chamado ${c.numero}`}>
                      Detalhes
                    </Botao>
                    <Botao variante="secundario" onClick={() => setAlterando(c.numero)} ariaLabel={`Atualizar status do chamado ${c.numero}`}>
                      Atualizar status
                    </Botao>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      <ModalStatus
        chamado={doStatus}
        onFechar={() => setAlterando(null)}
        onConfirmar={(status, nota) => {
          if (!doStatus) return;
          despachar({ tipo: 'chamado/status', numero: doStatus.numero, status, nota, autor: 'Prestador' });
          mostrar({ tom: 'ok', titulo: 'Status atualizado', texto: `O chamado #${doStatus.numero} agora está "${status}". O solicitante foi avisado por e-mail.` });
          setAlterando(null);
        }}
      />
      <ModalChamado chamado={doDetalhe} onFechar={() => setDetalhe(null)} />
    </Pagina>
  );
}


/* ═════════════════════════════════════════════════════════════════════════════
   9 · APP — cabeçalho global, sessões e roteamento
   Visitante, Gestor e Prestador têm entradas no cabeçalho; Gestor e Prestador
   exigem login. A visão ativa também vai para o hash da URL (#visitante,
   #gestor, #prestador), então dá para favoritar ou compartilhar.
   ═════════════════════════════════════════════════════════════════════════════ */

const NAV_VISITANTE: { tela: TelaVisitante; rotulo: string; ativoEm: TelaVisitante[] }[] = [
  { tela: 'reserva1', rotulo: 'Espaços', ativoEm: ['reserva1', 'reserva2', 'reserva3'] },
  { tela: 'visita', rotulo: 'Visita técnica', ativoEm: ['visita', 'visitaOk'] },
  { tela: 'chamado', rotulo: 'Abrir chamado', ativoEm: ['chamado', 'chamadoOk'] },
];

function perfilDoHash(): Perfil | null {
  try {
    const h = window.location.hash.replace('#', '');
    return h === 'visitante' || h === 'gestor' || h === 'prestador' ? h : null;
  } catch {
    return null;
  }
}

interface CabecalhoProps {
  perfil: Perfil;
  onPerfil: (p: Perfil) => void;
  telaV: TelaVisitante;
  irPara: (t: TelaVisitante) => void;
  abaG: AbaGestor;
  onAba: (a: AbaGestor) => void;
  nomeLogado: string | null;
  onSair: () => void;
}

function Cabecalho(p: CabecalhoProps) {
  const logado = p.nomeLogado !== null;
  return (
    <header className="ip-header">
      {/* Cabeçalho do produto (Figma: Header) */}
      <div className="ip-header-bar ip-gutter">
        <div className="ip-wrap ip-header-main flex flex-wrap items-center gap-x-6 gap-y-1 py-3">
          <Logo onClick={() => (p.perfil === 'visitante' ? p.irPara('home') : p.onPerfil('visitante'))} />

          <nav className="ip-nav order-last w-full min-w-0 md:order-none md:w-auto md:flex-1" aria-label="Navegação principal">
            {p.perfil === 'visitante' &&
              NAV_VISITANTE.map((i) => (
                <button key={i.tela} type="button" className="ip-nav-item" aria-current={i.ativoEm.includes(p.telaV) ? 'page' : undefined} onClick={() => p.irPara(i.tela)}>
                  {i.rotulo}
                </button>
              ))}
            {p.perfil === 'gestor' &&
              logado &&
              ABAS_GESTOR.map((a) => (
                <button key={a.id} type="button" className="ip-nav-item" aria-current={p.abaG === a.id ? 'page' : undefined} onClick={() => p.onAba(a.id)}>
                  {a.rotulo}
                </button>
              ))}
            {p.perfil === 'prestador' && logado && (
              <button type="button" className="ip-nav-item" aria-current="page">
                Meus chamados
              </button>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {p.perfil === 'visitante' && (
              <>
                <Botao variante="fantasma" pequeno onClick={() => p.onPerfil('prestador')} ariaLabel="Área do prestador">
                  <Wrench size={16} aria-hidden="true" />
                  <span className="hidden sm:inline">Área do prestador</span>
                </Botao>
                <Botao variante="secundario" pequeno onClick={() => p.onPerfil('gestor')} ariaLabel="Área do gestor">
                  <Briefcase size={16} aria-hidden="true" />
                  <span className="hidden sm:inline">Área do gestor</span>
                </Botao>
              </>
            )}
            {p.perfil !== 'visitante' && logado && (
              <>
                <span className="ip-t13 hidden text-ip-muted lg:inline">{p.nomeLogado}</span>
                <Botao variante="secundario" pequeno onClick={p.onSair}>
                  <LogOut size={16} aria-hidden="true" />
                  Sair
                </Botao>
              </>
            )}
            {p.perfil !== 'visitante' && !logado && (
              <Botao variante="fantasma" pequeno onClick={() => p.onPerfil('visitante')}>
                <ArrowLeft size={16} aria-hidden="true" />
                Voltar ao início
              </Botao>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default function App() {
  const [estado, despachar] = useReducer(reducer, null, criarEstadoInicial);
  const [perfil, setPerfil] = useState<Perfil>(() => perfilDoHash() ?? 'visitante');
  const [telaV, setTelaV] = useState<TelaVisitante>('home');
  const [rascunho, setRascunho] = useState<RascunhoReserva>(() => novoRascunho());
  const [abaG, setAbaG] = useState<AbaGestor>('fila');
  const principal = useRef<HTMLElement>(null);

  // Hash ↔ visão (apenas nomes simples, sem estado sensível na URL).
  useEffect(() => {
    const aoMudar = () => {
      const h = perfilDoHash();
      if (h) setPerfil(h);
    };
    window.addEventListener('hashchange', aoMudar);
    return () => window.removeEventListener('hashchange', aoMudar);
  }, []);

  const mudarPerfil = (novo: Perfil) => {
    setPerfil(novo);
    try {
      if (window.location.hash !== `#${novo}`) window.location.hash = novo;
    } catch {
      /* ambiente sem acesso ao hash: a troca de visão continua funcionando */
    }
  };

  // Ao voltar para o Visitante, telas de confirmação já ficaram para trás: vai para a Home,
  // onde o resumo mostra o status atualizado pelo Gestor.
  useEffect(() => {
    if (perfil !== 'visitante') return;
    if (telaV === 'reserva3' || telaV === 'visitaOk' || telaV === 'chamadoOk') irPara('home');
  }, [perfil]);

  const irPara = (t: TelaVisitante) => {
    if (telaV === 'reserva3' && t !== 'reserva3') setRascunho(novoRascunho());
    setTelaV(t);
  };

  useEffect(() => {
    try {
      window.scrollTo(0, 0);
    } catch {
      /* sem rolagem programática */
    }
  }, [perfil, telaV, abaG]);

  const prestador = PRESTADORES.find((x) => x.id === estado.sessao.prestadorId);
  const nomeLogado = perfil === 'gestor' && estado.sessao.gestor ? `${CONTAS_DEMO.gestor[0].nome} · Gestor` : perfil === 'prestador' && prestador ? `${prestador.nome} · Prestador` : null;

  const sair = () => {
    if (perfil === 'gestor') despachar({ tipo: 'sessao/sair', perfil: 'gestor' });
    if (perfil === 'prestador') despachar({ tipo: 'sessao/sair', perfil: 'prestador' });
    setAbaG('fila');
    mudarPerfil('visitante');
  };

  return (
    <LojaCtx.Provider value={{ estado, despachar }}>
      <div className="ip-root">
        <style>{ESTILOS}</style>
        <button type="button" className="ip-skip" onClick={() => principal.current?.focus()}>
          Pular para o conteúdo
        </button>
        <Cabecalho perfil={perfil} onPerfil={mudarPerfil} telaV={telaV} irPara={irPara} abaG={abaG} onAba={setAbaG} nomeLogado={nomeLogado} onSair={sair} />
        <main id="conteudo" ref={principal} tabIndex={-1}>
          {perfil === 'visitante' && <AreaVisitante tela={telaV} irPara={irPara} rascunho={rascunho} setRascunho={setRascunho} reiniciarRascunho={() => setRascunho(novoRascunho())} />}
          {perfil === 'gestor' && (estado.sessao.gestor ? <AreaGestor aba={abaG} /> : <GestorLogin onSucesso={() => setAbaG('fila')} />)}
          {perfil === 'prestador' && (estado.sessao.prestadorId ? <PrestadorChamados /> : <PrestadorLogin onSucesso={() => undefined} />)}
        </main>
        <footer className="ip-footer ip-gutter">
          <div className="ip-wrap ip-t13 py-10 text-ip-muted">InPETU hub · protótipo de demonstração com dados fictícios. Nada é enviado: e-mails e relatórios são simulados.</div>
        </footer>
        <Toasts />
      </div>
    </LojaCtx.Provider>
  );
}
