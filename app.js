const produtos = [
    { id: "comprarTenis", codigo: "tenis", nome: "Tênis Esportivo", preco: 299.90, imagem: "imagens/tenisC.jpg" },
    { id: "comprarCamisa", codigo: "camisa", nome: "Camisa Esportiva", preco: 350.00, imagem: "imagens/Bahia.jpg" },
    { id: "comprarBola", codigo: "bola", nome: "Bola de Futebol", preco: 259.90, imagem: "imagens/bola.jpg" },
    { id: "comprarChuteira", codigo: "chuteira", nome: "Chuteira", preco: 599.90, imagem: "imagens/chuteira2.jpg" },
    { id: "comprarOculos", codigo: "oculos", nome: "Óculos Esportivo", preco: 249.90, imagem: "imagens/oculespor.jpg" },
    { id: "comprarBasquete", codigo: "basquete", nome: "Camisa de Basquete", preco: 799.90, imagem: "imagens/bast3.png" }
];

function comprarProduto(produto) {
    if (
        typeof produto !== "object" ||
        produto === null ||
        typeof produto.codigo !== "string" ||
        typeof produto.nome !== "string" ||
        !Number.isFinite(produto.preco) ||
        produto.preco <= 0 ||
        typeof produto.imagem !== "string"
    ) {
        alert("Não foi possível iniciar a compra deste produto.");
        return;
    }

    const compra = { ...produto, quantidade: 1 };

    try {
        localStorage.setItem("compraAtual", JSON.stringify(compra));
    } catch (erro) {
        console.error("Não foi possível salvar a compra no navegador.", erro);
        alert("Não foi possível iniciar a compra. Verifique as configurações do navegador e tente novamente.");
        return;
    }

    window.location.href = "checkout.html";
}

for (let i = 0; i < produtos.length; i++) {
    const produto = produtos[i];
    const botao = document.getElementById(produto.id);

    if (botao) {
        botao.addEventListener("click", function () {
            comprarProduto(produto);
        });
    } else {
        console.error("Botão não encontrado para o produto: " + produto.nome);
    }
}
