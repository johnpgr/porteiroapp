
> Sempre que possível, use as práticas a seguir ao escrever, revisar ou refatorar código.
>
> O objetivo é manter o código **simples, limpo, legível, reutilizável e fácil de dar manutenção**.
>
> ---
>
> ### 🧩 **KISS (Keep It Simple, Stupid)**
>
> **Ideia:** mantenha o código simples e direto, evite complexidade desnecessária.
>
> **Ruim:**
>
> ```js
> function soma(a, b) {
>   if (typeof a === "number" && typeof b === "number") {
>     return a + b;
>   } else {
>     return parseInt(a) + parseInt(b);
>   }
> }
> ```
>
> **Melhor (KISS):**
>
> ```js
> function soma(a, b) {
>   return Number(a) + Number(b);
> }
> ```
>
> ---
>
> ### 🔁 **DRY (Don’t Repeat Yourself)**
>
> **Ideia:** evite repetir código. Se algo se repete, transforme em função, componente ou módulo.
>
> **Ruim:**
>
> ```js
> console.log("Erro: usuário não encontrado");
> alert("Erro: usuário não encontrado");
> ```
>
> **Melhor (DRY):**
>
> ```js
> function exibirErro(msg) {
>   console.log(`Erro: ${msg}`);
>   alert(`Erro: ${msg}`);
> }
> exibirErro("usuário não encontrado");
> ```
>
> ---
>
> ### 🧼 **Clean Code**
>
> **Ideia:** código limpo é fácil de ler, entender e manter.
>
> * Use **nomes claros e descritivos**
> * Funções devem ter **uma única responsabilidade**
> * Evite **comentários desnecessários**
> * Mantenha **formatação e estilo consistentes**
>
> **Ruim:**
>
> ```js
> function x(a, b) {
>   return a * b + a * a;
> }
> ```
>
> **Melhor (Clean Code):**
>
> ```js
> function calcularAreaTotal(base, altura) {
>   return base * altura + base * base;
> }
> ```
>
> ---
>
> ### ⚙️ **SOLID**
>
> **Conjunto de princípios para código orientado a objetos bem estruturado e flexível.**
>
> * **S — Single Responsibility:** cada módulo deve ter uma única responsabilidade.
>
>   ```js
>   // Ruim: função faz várias coisas
>   function salvarUsuario(usuario) {
>     validarUsuario(usuario);
>     salvarNoBanco(usuario);
>     enviarEmailBoasVindas(usuario);
>   }
>
>   // Melhor: separar responsabilidades
>   function salvarUsuario(usuario) {
>     validarUsuario(usuario);
>     salvarNoBanco(usuario);
>   }
>
>   function enviarBoasVindas(usuario) {
>     enviarEmailBoasVindas(usuario);
>   }
>   ```
>
> * **O — Open/Closed:** código aberto para extensão, fechado para modificação.
>
>   ```js
>   // Em vez de editar a função original, adicione novas classes ou métodos.
>   class EnviadorDeNotificacao {
>     enviar(mensagem) {}
>   }
>
>   class EnviadorEmail extends EnviadorDeNotificacao {
>     enviar(mensagem) { console.log("Email:", mensagem); }
>   }
>
>   class EnviadorSMS extends EnviadorDeNotificacao {
>     enviar(mensagem) { console.log("SMS:", mensagem); }
>   }
>   ```
>
> * **L — Liskov Substitution:** classes filhas devem poder substituir as pais sem quebrar o sistema.
>
> * **I — Interface Segregation:** prefira interfaces pequenas e específicas.
>
> * **D — Dependency Inversion:** dependa de abstrações, não implementações concretas.
>
> ---
>
> ### 🚫 **YAGNI (You Aren’t Gonna Need It)**
>
> **Ideia:** não adicione funcionalidades que ainda não são necessárias.
>
> **Ruim:**
>
> ```js
> // Adicionando suporte a múltiplas moedas sem precisar ainda
> function calcularPreco(produto, moeda = "BRL") {
>   if (moeda === "USD") return produto.preco * 0.19;
>   if (moeda === "EUR") return produto.preco * 0.17;
>   return produto.preco;
> }
> ```
>
> **Melhor (YAGNI):**
>
> ```js
> function calcularPreco(produto) {
>   return produto.preco;
> }
> ```
>
> ---
>
> ### 🧱 **SOC (Separation of Concerns)**
>
> **Ideia:** separe responsabilidades em camadas/módulos distintos.
>
> **Exemplo (front/back):**
>
> * Frontend → interface e experiência do usuário
> * Backend → lógica de negócio
> * Banco de dados → persistência de dados
>
> **Exemplo em código:**
>
> ```js
> // Controller
> function criarUsuarioController(req, res) {
>   const usuario = criarUsuarioService(req.body);
>   res.json(usuario);
> }
>
> // Service
> function criarUsuarioService(dados) {
>   validarDados(dados);
>   return salvarUsuarioNoBanco(dados);
> }
> ```
>
> ---
>
> ### ⚡ **Convention Over Configuration**
>
> **Ideia:** use convenções padrão (nomes, pastas, rotas) para evitar configuração manual.
> Exemplo: frameworks como Next.js ou Rails já trazem convenções que reduzem o boilerplate.
>
> **Ruim:**
> Criar estrutura de pastas e rotas personalizadas para tudo.
>
> **Melhor:**
> Seguir convenções do framework (ex: `/pages`, `/api`, etc.).
>
> ---
>
> ### 🧭 **Principle of Least Surprise**
>
> **Ideia:** o código deve fazer exatamente o que parece que vai fazer.
>
> **Ruim:**
>
> ```js
> function deletarUsuario(id) {
>   // apenas desativa, mas o nome sugere exclusão real
>   desativarUsuario(id);
> }
> ```
>
> **Melhor:**
>
> ```js
> function desativarUsuario(id) {
>   // nome e ação coerentes
>   desativarUsuarioNoBanco(id);
> }
> ```
>
> ---
>
> **💡 Em resumo:**
>
> * Escreva código legível, modular e simples.
> * Evite repetições e complexidade.
> * Mantenha separação clara entre responsabilidades.
> * Siga padrões e convenções.
> * Faça o código expressar sua intenção de forma clara e previsível.

---
- em hipotese alguma mude o layout ou design do projeto atual, mude apenas se eu for bem claro e peça pra vc mudar algo no layout ou design, ao contrario nao mude nada do css etc.