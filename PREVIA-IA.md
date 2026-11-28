# Prévia realista com IA (opcional) — Nail Virtual

Extraia os arquivos na mesma pasta do `index.html` do v14. Este ZIP também pode ser usado como atualização sobre sua instalação completa. O pacote de origem contém apenas o HTML, `ex-curl.webp` e `guide-curl.png`. Conserve os demais recursos de sua instalação, como as imagens da marca, `hands.js` e os modelos dos detectores. A prévia com IA pode funcionar mesmo quando o detector local não encontra unhas.

## Iniciar no Windows

Requer Node.js 22 ou superior e um projeto na plataforma da OpenAI com chave, faturamento e acesso ao modelo de edição. Na pasta extraída, crie no seu computador um arquivo chamado `.env` com uma linha:

```dotenv
OPENAI_API_KEY=cole_sua_chave_aqui
```

Abra o PowerShell nessa pasta e execute:

```powershell
node --env-file=.env servidor-ia.mjs
```

Abra **http://localhost:3000**. Opcionalmente, defina outra porta com `PORT` no mesmo arquivo. Guarde o arquivo de chave somente no servidor e fora do ZIP ou do repositório (o `.env` já está no `.gitignore`).

## Como funciona

- O botão **✨ Ver resultado realista com IA** só aparece quando o app está aberto pelo `servidor-ia.mjs` (no GitHub Pages ele fica escondido, porque lá não há servidor nem chave).
- O app manda para a IA a foto da mão **e uma máscara com as unhas que ele já detectou**. A IA pinta só ali.
- Quando a imagem volta, o app cola **somente as unhas geradas** sobre a foto original. Pele, anéis e fundo ficam idênticos.
- Segure a imagem para comparar com a prévia do aparelho.

## Experimentar

1. Abra o provador e carregue uma foto.
2. Escolha a cor, a nail art e, se desejar, o formato de alongamento.
3. Toque em **Ver resultado realista com IA**. Se houver duas fotos, selecione a mão.
4. Toque em **Gerar prévia com IA** para autorizar o envio. Cada geração faz uma chamada paga à API de edição de imagens. Trocar a cor no pincel local não faz chamadas.
5. Feche a prévia para voltar ao provador. A imagem gerada fica em memória nessa janela. Para experimentar outra combinação, altere o pedido e abra a prévia novamente.

O servidor processa a foto em memória. A edição usa a foto anterior à pintura e ao recorte de fundo. Fotos novas também conservam a foto anterior ao alinhamento. Para fotos antigas já alinhadas, a edição usa a versão disponível no aparelho. A exclusão local em 24 horas não representa o prazo de retenção da OpenAI.

Este servidor é para uso local. Para disponibilizar a clientes, integre a rota ao backend autenticado da sua hospedagem, via HTTPS, e aplique uma cota de gerações por cliente antes de habilitar cobranças. A chave fica nesse backend.

[API de edição de imagens](https://developers.openai.com/api/docs/guides/image-generation) · [Política de dados da API](https://developers.openai.com/api/docs/guides/your-data)
