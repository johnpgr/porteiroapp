import Link from 'next/link';

export default function PoliticasPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <div className="text-3xl">🏢</div>
            <h1 className="text-2xl font-bold text-gray-900">
              JAMES AVISA
            </h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Política de Privacidade</h1>
          
          <div className="prose prose-lg max-w-none text-gray-700 space-y-6">
            <p>
              A sua privacidade é importante para nós. É política do James avisa respeitar a sua privacidade em relação a qualquer informação sua que possamos coletar no site{' '}
              <a href="https://jamesavisa.jamesconcierge.com/" className="text-blue-600 hover:text-blue-800 underline">
                James avisa
              </a>
              , e outros sites que possuímos e operamos.
            </p>

            <p>
              Solicitamos informações pessoais apenas quando realmente precisamos delas para lhe fornecer um serviço. Fazemo-lo por meios justos e legais, com o seu conhecimento e consentimento. Também informamos por que estamos coletando e como será usado.
            </p>

            <p>
              Apenas retemos as informações coletadas pelo tempo necessário para fornecer o serviço solicitado. Quando armazenamos dados, protegemos dentro de meios comercialmente aceitáveis ​​para evitar perdas e roubos, bem como acesso, divulgação, cópia, uso ou modificação não autorizados.
            </p>

            <p>
              Não compartilhamos informações de identificação pessoal publicamente ou com terceiros, exceto quando exigido por lei.
            </p>

            <p>
              O nosso site pode ter links para sites externos que não são operados por nós. Esteja ciente de que não temos controle sobre o conteúdo e práticas desses sites e não podemos aceitar responsabilidade por suas respectivas{' '}
              <a href="https://politicaprivacidade.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                políticas de privacidade
              </a>
              .
            </p>

            <p>
              Você é livre para recusar a nossa solicitação de informações pessoais, entendendo que talvez não possamos fornecer alguns dos serviços desejados.
            </p>

            <p>
              O uso continuado de nosso site será considerado como aceitação de nossas práticas em torno de privacidade e informações pessoais. Se você tiver alguma dúvida sobre como lidamos com dados do usuário e informações pessoais, entre em contacto connosco.
            </p>

            <ul className="list-disc pl-6 space-y-3">
              <li>
                O serviço Google AdSense que usamos para veicular publicidade usa um cookie DoubleClick para veicular anúncios mais relevantes em toda a Web e limitar o número de vezes que um determinado anúncio é exibido para você.
              </li>
              <li>
                Para mais informações sobre o Google AdSense, consulte as FAQs oficiais sobre privacidade do Google AdSense.
              </li>
              <li>
                Utilizamos anúncios para compensar os custos de funcionamento deste site e fornecer financiamento para futuros desenvolvimentos. Os cookies de publicidade comportamental usados ​​por este site foram projetados para garantir que você forneça os anúncios mais relevantes sempre que possível, rastreando anonimamente seus interesses e apresentando coisas semelhantes que possam ser do seu interesse.
              </li>
              <li>
                Vários parceiros anunciam em nosso nome e os cookies de rastreamento de afiliados simplesmente nos permitem ver se nossos clientes acessaram o site através de um dos sites de nossos parceiros, para que possamos creditá-los adequadamente e, quando aplicável, permitir que nossos parceiros afiliados ofereçam qualquer promoção que pode fornecê-lo para fazer uma compra.
              </li>
            </ul>

            <section className="mt-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Compromisso do Usuário</h2>
              <p>
                O usuário se compromete a fazer uso adequado dos conteúdos e da informação que o James avisa oferece no site e com caráter enunciativo, mas não limitativo:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>
                  <strong>A)</strong> Não se envolver em atividades que sejam ilegais ou contrárias à boa fé a à ordem pública;
                </li>
                <li>
                  <strong>B)</strong> Não difundir propaganda ou conteúdo de natureza racista, xenofóbica, jogos de sorte ou azar, qualquer tipo de pornografia ilegal, de apologia ao terrorismo ou contra os direitos humanos;
                </li>
                <li>
                  <strong>C)</strong> Não causar danos aos sistemas físicos (hardwares) e lógicos (softwares) do James avisa, de seus fornecedores ou terceiros, para introduzir ou disseminar vírus informáticos ou quaisquer outros sistemas de hardware ou software que sejam capazes de causar danos anteriormente mencionados.
                </li>
              </ul>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Mais informações</h2>
              <p>
                Esperemos que esteja esclarecido e, como mencionado anteriormente, se houver algo que você não tem certeza se precisa ou não, geralmente é mais seguro deixar os cookies ativados, caso interaja com um dos recursos que você usa em nosso site.
              </p>
              <p className="mt-4">
                <strong>Esta política é efetiva a partir de 26 August 2025 22:03</strong>
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200">
            <Link 
              href="/" 
              className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Voltar ao início
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}