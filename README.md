# OlimpicSports — E-commerce acadêmico (versão 2.0)

Este projeto **mantém a identidade visual e os arquivos originais da OlimpicSports** (preto, verde-limão, carrossel, seis produtos, suas fotos e preços), acrescentando uma aplicação web de múltiplas páginas com servidor Node.js e banco SQLite.

> **Projeto acadêmico demonstrativo.** Não realiza cobranças, gera PIX válido, captura dados de cartão, calcula frete real ou contrata transportadoras. Preços, contatos e produtos são fictícios. O banco registra pedidos **simulados**.

## Funcionalidades

| Visitante / cliente | Administrador |
| --- | --- |
| Página inicial e carrossel original | Acesso protegido por papel `admin` no servidor |
| Catálogo com busca e filtro por categoria | Cadastrar, editar e desativar produtos |
| Hover nos cards: zoom e convite a visualizar | Subir fotos JPG/PNG/WebP e marcar ofertas/destaques |
| Páginas de detalhes para cada produto | Ajustar estoque e consultar histórico de movimentações |
| Cadastro com função `user` e login | Consultar e atualizar status de pedidos |
| Sessões seguras em cookie HttpOnly | Cancelar pedido com devolução ao estoque |
| Carrinho persistente por conta no banco | Consultar clientes cadastrados (sem senhas) |
| Cadastro, edição, exclusão e escolha de endereço principal | Lançamentos manuais de receitas/despesas |
| Checkout e pedidos **simulados** em PIX/cartão/boleto | Indicadores de vendas simuladas separados de receitas manuais |
| Histórico e status dos pedidos | Gestão financeira com saldo e movimentações |
| Atualização do nome e troca de senha | Conta inicial protegida, criada só pelo servidor |

O menu original agora navega corretamente para Início, Produtos, Categorias, Ofertas, Sobre, Contato, Entrar/Minha conta, Carrinho e Gestão (somente administrador).

## 1. Requisitos

- **Node.js 22.5 ou posterior** (usa o módulo nativo `node:sqlite`; não exige `npm install`). Recomendamos uma versão LTS recente que inclua esse recurso.
- Navegador moderno; internet para os arquivos CSS/JS do Bootstrap disponibilizados via CDN (assim como no projeto original).

## 2. Iniciar no seu computador

1. Extraia o ZIP do projeto.
2. Abra um terminal **dentro da pasta `OlimpicSports-main`**.
3. Crie um arquivo `.env` baseado em `.env.example`.
4. Preencha `ADMIN_EMAIL` com um endereço sob seu controle e `ADMIN_PASSWORD` com uma senha **única de no mínimo 12 caracteres**. Não deixe os campos em branco.
5. Inicie o servidor:

```bash
node --env-file=.env server.js
```

6. Abra **http://localhost:3000**.

### Exemplo no Windows PowerShell

```powershell
Copy-Item .env.example .env
notepad .env
node --env-file=.env server.js
```

### Exemplo no Linux / macOS

```bash
cp .env.example .env
# Edite o arquivo .env antes de iniciar
node --env-file=.env server.js
```

**Primeira execução:** o servidor cria automaticamente a conta administrativa e os seis produtos originais. Clientes podem clicar em **Criar conta**; esses cadastros são sempre `user`. A conta administradora **não pode ser criada ou promovida pelo formulário público**.

**Próximas execuções:** os dados são preservados no arquivo `.data/olimpic.sqlite`, desde que ele não seja apagado. As variáveis de administrador inicializam a conta apenas na primeira execução; mudar `ADMIN_PASSWORD` no `.env` posteriormente **não altera a senha já cadastrada**. A senha pode ser alterada em Minha Conta (ela encerra todas as sessões da conta).

Para testes automatizados:

```bash
npm test
```

## 3. Páginas

- `index.html`: página inicial com o carrossel e os cards originais, agora alimentados pelo catálogo.
- `produtos.html`: busca, categorias, ofertas e cards interativos.
- `categorias.html` / `ofertas.html`: páginas exclusivas para modalidades e produtos em oferta.
- `produto.html?id=1`: página própria de detalhes (cada produto tem uma URL única).
- `carrinho.html`: itens, quantidades e subtotal.
- `checkout.html`: resumo, seleção de endereço e pedido demonstrativo.
- `login.html` / `cadastro.html`: autenticação.
- `conta.html`: dados pessoais, senha, endereços e pedidos.
- `admin.html`: painel de gerenciamento (requer login como admin).
- `sobre.html` / `contato.html`: informações institucionais da marca acadêmica.

## 4. Funcionamento e segurança

- SQLite no servidor: produtos, usuários, senhas criptograficamente derivadas com `scrypt` e salt individual, sessões, endereços, carrinhos, pedidos, movimentações e finanças.
- Tokens de sessão aleatórios, armazenados como **hash** no banco, entregues ao navegador em cookie **HttpOnly + SameSite**; em HTTPS de produção, configurar `NODE_ENV=production` para habilitar `Secure`.
- Autorização verificada **em cada endpoint administrativo**, nunca apenas pelo menu. Um cadastro público é criado com função `user`.
- Compras calculadas pelo servidor a partir do preço e estoque atuais, com transação que impede quantidade negativa e mantém os itens do pedido em snapshot histórico.
- Produtos desativados desaparecem do catálogo, sem apagar os itens em pedidos passados.
- Exclusão ou cancelamento de pedido não gera cobranças reais. **Receita financeira efetiva não é inferida de pedidos demonstrativos.**
- Imagens enviadas podem ser guardadas na pasta `uploads/`; preserve-a junto com o banco ao fazer backups.
- Não expor arquivos `.env`, `.data`, backups ou tokens. O servidor inclui cabeçalhos de proteção e só serve os arquivos públicos permitidos.

## 5. Publicar na internet

**GitHub Pages não executa Node.js nem mantém um SQLite do servidor.** Portanto, a versão completa não funciona publicada diretamente pelo GitHub Pages como site estático. Será necessária hospedagem com **Node.js, HTTPS e armazenamento persistente** (disco/volume para `.data/` e `uploads/`).

Antes de publicar para pessoas reais, revisar LGPD/política de privacidade, backup/restauração, recuperação/verificação de e-mail, observabilidade, regras de frete e integrações com processadores de pagamento e logística. É recomendado também trocar SQLite por um banco gerenciado em cenários de alta concorrência e realizar auditoria de segurança e testes de carga. Não conecte pagamentos reais sem uma integração certificada (ex.: gateway com hospedagem do checkout) e tratamento dos respectivos webhooks.

## 6. Organização técnica

- `server.js`: APIs REST, banco de dados SQLite, autenticação/sessão, regras de estoque, pedidos e admin.
- `store.js`: cliente HTTP, catálogo de cards, navegação, carrinho e formatação.
- `app.js`, `catalogo.js`, `produto.js`, `carrinho.js`, `checkout.js`, `auth.js`, `conta.js`, `admin.js`: lógica individual das páginas.
- `style.css`: estilo original preservado, com novos estilos complementares.
- `imagens/`: imagens do projeto original mantidas.
- `tests/`: teste de integração do fluxo principal com banco temporário.
- `.env.example`: modelo de configuração (nunca publique seu `.env` real).

## Créditos e contexto

Baseado no repositório [NoabeOliveira/OlimpicSports](https://github.com/NoabeOliveira/OlimpicSports), projeto acadêmico da disciplina de Programação Front-End (UNIFAN). Esta entrega é uma versão expandida, não um commit publicado no repositório oficial.
