# Lume · Provador de unhas

Aplicação 100% estática (HTML + JS + arquivos de IA). Não precisa de servidor próprio nem de build.

## Rodar no seu computador (VS Code)
1. Abra esta pasta no VS Code.
2. Instale a extensão **Live Server** (Ritwick Dey).
3. Clique com o botão direito em `index.html` → **Open with Live Server**.

Não abra o `index.html` com duplo clique (file://): a IA precisa ser servida por http.

## Publicar
Qualquer hospedagem de site estático com HTTPS serve (a câmera do celular só funciona em HTTPS):
- **Vercel**: `npx vercel` nesta pasta → aceite as perguntas → `npx vercel --prod`.
- **Netlify**: arraste a pasta em app.netlify.com/drop.
- **GitHub Pages**: suba a pasta num repositório → Settings → Pages → Branch `main` / root.

Observação: os dados (agenda, estoque, ganhos) ficam salvos no navegador de quem usa. Para várias pessoas compartilharem os mesmos dados, é preciso um backend (login + banco).
