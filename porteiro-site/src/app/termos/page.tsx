export default function TermosPage() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Termos de Uso</h1>
          
          <div className="prose prose-lg max-w-none text-gray-700 space-y-6">
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Termos</h2>
              <p>
                Ao acessar ao site James avisa, concorda em cumprir estes termos de serviço, todas as leis e regulamentos aplicáveis ​​e concorda que é responsável pelo cumprimento de todas as leis locais aplicáveis. Se você não concordar com algum desses termos, está proibido de usar ou acessar este site. Os materiais contidos neste site são protegidos pelas leis de direitos autorais e marcas comerciais aplicáveis.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Uso de Licença</h2>
              <p>
                É concedida permissão para baixar temporariamente uma cópia dos materiais (informações ou software) no site James avisa, apenas para visualização transitória pessoal e não comercial. Esta é a concessão de uma licença, não uma transferência de título e, sob esta licença, você não pode:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>modificar ou copiar os materiais;</li>
                <li>usar os materiais para qualquer finalidade comercial ou para exibição pública (comercial ou não comercial);</li>
                <li>tentar descompilar ou fazer engenharia reversa de qualquer software contido no site James avisa;</li>
                <li>remover quaisquer direitos autorais ou outras notações de propriedade dos materiais; ou</li>
                <li>transferir os materiais para outra pessoa ou 'espelhe' os materiais em qualquer outro servidor.</li>
              </ul>
              <p>
                Esta licença será automaticamente rescindida se você violar alguma dessas restrições e poderá ser rescindida por James avisa a qualquer momento. Ao encerrar a visualização desses materiais ou após o término desta licença, você deve apagar todos os materiais baixados em sua posse, seja em formato eletrónico ou impresso.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Isenção de responsabilidade</h2>
              <p>
                Os materiais no site da James avisa são fornecidos 'como estão'. James avisa não oferece garantias, expressas ou implícitas, e, por este meio, isenta e nega todas as outras garantias, incluindo, sem limitação, garantias implícitas ou condições de comercialização, adequação a um fim específico ou não violação de propriedade intelectual ou outra violação de direitos.
              </p>
              <p>
                Além disso, o James avisa não garante ou faz qualquer representação relativa à precisão, aos resultados prováveis ​​ou à confiabilidade do uso dos materiais em seu site ou de outra forma relacionado a esses materiais ou em sites vinculados a este site.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Limitações</h2>
              <p>
                Em nenhum caso o James avisa ou seus fornecedores serão responsáveis ​​por quaisquer danos (incluindo, sem limitação, danos por perda de dados ou lucro ou devido a interrupção dos negócios) decorrentes do uso ou da incapacidade de usar os materiais em James avisa, mesmo que James avisa ou um representante autorizado da James avisa tenha sido notificado oralmente ou por escrito da possibilidade de tais danos. Como algumas jurisdições não permitem limitações em garantias implícitas, ou limitações de responsabilidade por danos conseqüentes ou incidentais, essas limitações podem não se aplicar a você.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Precisão dos materiais</h2>
              <p>
                Os materiais exibidos no site da James avisa podem incluir erros técnicos, tipográficos ou fotográficos. James avisa não garante que qualquer material em seu site seja preciso, completo ou atual. James avisa pode fazer alterações nos materiais contidos em seu site a qualquer momento, sem aviso prévio. No entanto, James avisa não se compromete a atualizar os materiais.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Links</h2>
              <p>
                O James avisa não analisou todos os sites vinculados ao seu site e não é responsável pelo conteúdo de nenhum site vinculado. A inclusão de qualquer link não implica endosso por James avisa do site. O uso de qualquer site vinculado é por conta e risco do usuário.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Modificações</h2>
              <p>
                O James avisa pode revisar estes termos de serviço do site a qualquer momento, sem aviso prévio. Ao usar este site, você concorda em ficar vinculado à versão atual desses termos de serviço.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Lei aplicável</h2>
              <p>
                Estes termos e condições são regidos e interpretados de acordo com as leis do James avisa e você se submete irrevogavelmente à jurisdição exclusiva dos tribunais naquele estado ou localidade.
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200">
            <a 
              href="/" 
              className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Voltar ao início
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}