# InPETU Hub

Reserva de espaços, visitas técnicas guiadas e chamados, com as áreas do Visitante (sem login), do Gestor e do Prestador.
Aplicação de página única em React + TypeScript + Tailwind CSS, sem backend: os dados vivem na memória do navegador e recarregar a página restaura os exemplos.

## Estrutura

```
inpetu-hub/
├── index.html          # entrada do Vite (raiz do projeto)
├── netlify.toml        # build, publicação, Node, redirecionamento de SPA e cabeçalhos
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .nvmrc  .npmrc  .gitignore  .env.example
├── public/
│   └── favicon.svg     # copiado como está para a raiz do site
└── src/
    ├── main.tsx        # monta o React
    ├── index.css       # Tailwind + ajustes globais
    ├── App.tsx         # aplicação completa em um único arquivo
    └── vite-env.d.ts
```

Não há funções serverless: a pasta `netlify/functions` não é necessária.

## Rodar localmente

```bash
npm install
cp .env.example .env     # opcional
npm run dev              # http://localhost:5173
npm run build            # gera dist/
npm run preview          # serve o dist/ localmente
npm run typecheck        # checagem de tipos (fora do build do Netlify)
```

Requer Node 20 ou superior (o Netlify usa o 22, definido no `netlify.toml` e no `.nvmrc`).

## Variáveis de ambiente

| Variável | Obrigatória | Para que serve |
| --- | --- | --- |
| `VITE_HOJE_SIMULADO` | Não | Data usada como "hoje" (`aaaa-mm-dd`). Padrão `2026-10-14`. Um valor que não seja data, como `real`, usa a data do navegador. |

Variáveis `VITE_*` ficam visíveis no navegador. Não há chaves de API, analytics nem URLs de outra conta no código.
As contas de demonstração do Gestor e do Prestador são fictícias e já vêm preenchidas nas telas de login.

## Deploy no Netlify

### Opção A: GitHub (recomendada)

1. Crie um repositório no GitHub e envie esta pasta:
   ```bash
   git init && git add . && git commit -m "InPETU Hub"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/inpetu-hub.git
   git push -u origin main
   ```
2. No Netlify: **Add new site > Import an existing project > GitHub** e escolha o repositório.
3. Confira: Build command `npm run build`, Publish directory `dist` (vêm do `netlify.toml`).
4. (Opcional) Em **Site configuration > Environment variables**, cadastre `VITE_HOJE_SIMULADO`.
5. Clique em **Deploy**. Cada `git push` na `main` publica de novo.

### Opção B: Netlify CLI

```bash
npm install
npm install -g netlify-cli
netlify login
netlify init            # ou: netlify deploy --build (rascunho) e netlify deploy --build --prod
```

### Opção C: upload manual

```bash
npm install && npm run build
```
No Netlify: **Add new site > Deploy manually** e arraste a pasta `dist/`.
(Variáveis do painel não valem nesse modo: elas só entram em builds feitos pelo Netlify. Para usar `VITE_HOJE_SIMULADO`, crie o `.env` antes de `npm run build`.)

## Problemas comuns

- **Página em branco ou 404 ao atualizar**: confirme que o `netlify.toml` está na raiz do repositório (regra `/* /index.html 200`).
- **`npm install` falha por peerDependencies**: o `.npmrc` já ativa `legacy-peer-deps`; confirme que o arquivo foi enviado.
- **Mudei uma variável e nada mudou**: variáveis `VITE_*` entram no momento do build. Faça **Deploys > Trigger deploy > Clear cache and deploy site**.
