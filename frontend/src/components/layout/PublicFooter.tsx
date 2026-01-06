import { Link } from "react-router-dom";

export function PublicFooter() {
  return (
    <footer className="bg-blue-900 text-white py-12 px-4">
      <div className="container mx-auto">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <img src="/logo.png" alt="ACJF" className="h-8" />
              <div>
                <h3 className="font-bold">Aeroclube de Juiz de Fora</h3>
                <p className="text-sm text-blue-200">Escola de aviação</p>
              </div>
            </div>
            <p className="text-blue-200 text-sm">
              Excelência em formação aeronáutica desde 1938.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Acesso rápido</h4>
            <ul className="space-y-2 text-sm text-blue-200">
              <li><Link to="/login" className="hover:text-white">Entrar</Link></li>
              <li><Link to="/public-client-form" className="hover:text-white">Cadastro</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Institucional</h4>
            <ul className="space-y-2 text-sm text-blue-200">
              <li><a href="https://aeroclubejf.com.br/" target="_blank" rel="noreferrer" className="hover:text-white">Site oficial</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-blue-800 mt-8 pt-8 text-center text-sm text-blue-200">
          <p>&copy; {new Date().getFullYear()} Aeroclube de Juiz de Fora. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
