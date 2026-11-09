const quantidade = document.getElementById("quantidade");
const resumoPedido = document.getElementById("resumoPedido");
const valorTotal = document.getElementById("valorTotal");
const formulario = document.getElementById("formCompra");
const mensagem = document.getElementById("mensagemCompra");
const botaoConfirmar = document.getElementById("confirmarCompra");
const pagamentoSelect = document.getElementById("pagamento");
const areaCartao = document.getElementById("areaCartao");
const areaPix = document.getElementById("areaPix");
const areaBoleto = document.getElementById("areaBoleto");
const selectParcelas = document.getElementById("parcelas");
const resumoParcelas = document.getElementById("resumoParcelas");

function carregarCompra() {
    try {
        const compra = JSON.parse(localStorage.getItem("compraAtual"));

        if (
            !compra ||
            typeof compra.codigo !== "string" ||
            typeof compra.nome !== "string" ||
            !Number.isFinite(compra.preco) ||
            compra.preco <= 0 ||
            typeof compra.imagem !== "string"
        ) {
            throw new TypeError("Os dados do produto selecionado são inválidos.");
        }

        return compra;
    } catch (erro) {
        console.error("Não foi possível carregar o produto selecionado.", erro);
        mensagem.textContent = "Nenhum produto válido foi selecionado. Volte à loja e escolha um produto.";
        return null;
    }
}

const compra = carregarCompra();

function formatarPreco(valor) {
    return valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function obterQuantidade() {
    const valor = Number(quantidade.value);

    if (!Number.isInteger(valor) || valor < 1 || valor > 99) {
        quantidade.value = compra.quantidade || 1;
        mensagem.textContent = "Informe uma quantidade entre 1 e 99.";
        return Number(quantidade.value);
    }

    compra.quantidade = valor;
    return valor;
}

function atualizarTotal() {
    const qtd = obterQuantidade();
    const totalCentavos = Math.round(compra.preco * 100) * qtd;
    valorTotal.textContent = "Total: " + formatarPreco(totalCentavos / 100);
    return totalCentavos;
}

function atualizarParcelas() {
    selectParcelas.replaceChildren();

    const opcaoInicial = document.createElement("option");
    opcaoInicial.value = "";
    opcaoInicial.textContent = "Selecione as parcelas";
    selectParcelas.appendChild(opcaoInicial);

    const totalCentavos = atualizarTotal();
    for (let i = 1; i <= 6; i++) {
        const base = Math.floor(totalCentavos / i);
        const resto = totalCentavos % i;
        const opcao = document.createElement("option");

        opcao.value = i;
        if (resto === 0) {
            opcao.textContent = i + "x de " + formatarPreco(base / 100) + " (sem juros)";
        } else {
            opcao.textContent =
                (i - resto) + "x de " + formatarPreco(base / 100) +
                " + " + resto + "x de " + formatarPreco((base + 1) / 100) +
                " (sem juros)";
        }
        selectParcelas.appendChild(opcao);
    }

    resumoParcelas.textContent = "";
}

function mostrarFormaPagamento() {
    areaCartao.style.display = "none";
    areaPix.style.display = "none";
    areaBoleto.style.display = "none";
    selectParcelas.required = false;
    resumoParcelas.textContent = "";

    switch (pagamentoSelect.value) {
        case "cartao":
            areaCartao.style.display = "block";
            selectParcelas.required = true;
            atualizarParcelas();
            break;
        case "pix":
            areaPix.style.display = "block";
            gerarQRCode();
            break;
        case "boleto":
            areaBoleto.style.display = "block";
            break;
        default:
            break;
    }
}

function gerarQRCode() {
    const areaQRCode = document.getElementById("qrcodePix");
    areaQRCode.replaceChildren();

    if (typeof QRCode === "undefined") {
        console.error("Biblioteca QRCode não carregada.");
        areaQRCode.textContent = "QR Code demonstrativo indisponível.";
        return;
    }

    new QRCode(areaQRCode, {
        text: "OLIMPICSPORTS - QR CODE DEMONSTRATIVO",
        width: 220,
        height: 220,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
}

function confirmarPedido(evento) {
    evento.preventDefault();

    if (!compra) {
        mensagem.textContent = "Selecione um produto antes de finalizar a compra.";
        return;
    }

    const totalCentavos = atualizarTotal();
    let formaPagamento;

    switch (pagamentoSelect.value) {
        case "pix":
            formaPagamento = "PIX";
            break;
        case "cartao":
            formaPagamento = "Cartão de crédito";
            if (!selectParcelas.value) {
                mensagem.textContent = "Selecione o número de parcelas.";
                return;
            }
            break;
        case "boleto":
            formaPagamento = "Boleto";
            break;
        default:
            mensagem.textContent = "Selecione uma forma de pagamento válida.";
            return;
    }

    const pedido = {
        numero: Date.now(),
        cliente: document.getElementById("nomeCliente").value.trim(),
        email: document.getElementById("emailCliente").value.trim(),
        produto: compra.nome,
        precoUnitario: compra.preco,
        quantidade: Number(quantidade.value),
        total: totalCentavos / 100,
        pagamento: formaPagamento,
        parcelas: pagamentoSelect.value === "cartao" ? Number(selectParcelas.value) : 1,
        status: "Simulado"
    };

    try {
        localStorage.setItem("ultimoPedido", JSON.stringify(pedido));
        localStorage.removeItem("compraAtual");
    } catch (erro) {
        console.error("Não foi possível salvar o pedido.", erro);
        mensagem.textContent = "Não foi possível salvar o pedido neste navegador. Tente novamente.";
        return;
    }

    mensagem.textContent =
        "Pedido nº " + pedido.numero + " confirmado! Total: " +
        formatarPreco(pedido.total) + ". Pagamento selecionado: " +
        formaPagamento + ". Esta é uma compra simulada, sem cobrança real.";

    formulario.reset();
    botaoConfirmar.disabled = true;
    quantidade.disabled = true;
}

if (compra) {
    resumoPedido.textContent = compra.nome + " — " + formatarPreco(compra.preco);
    quantidade.value = Number.isInteger(compra.quantidade) && compra.quantidade > 0
        ? compra.quantidade
        : 1;
    atualizarTotal();
    quantidade.addEventListener("change", function () {
        atualizarTotal();
        if (pagamentoSelect.value === "cartao") {
            atualizarParcelas();
        }
    });
} else {
    botaoConfirmar.disabled = true;
    quantidade.disabled = true;
}

pagamentoSelect.addEventListener("change", mostrarFormaPagamento);
selectParcelas.addEventListener("change", function () {
    resumoParcelas.textContent = selectParcelas.value
        ? "Parcelamento selecionado em " + selectParcelas.value + "x sem juros."
        : "";
});
formulario.addEventListener("submit", confirmarPedido);
