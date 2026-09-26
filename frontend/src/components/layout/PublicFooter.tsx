import { Link } from "react-router-dom";

export function PublicFooter() {
  return (
    <footer className="bg-blue-900 dark:bg-zinc-950 text-white py-12 px-4 border-t border-transparent dark:border-zinc-800">
      <div className="container mx-auto">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <img src="/logo.png" alt="ACJF" className="h-8" />
              <div>
                <h3 className="font-bold">Aeroclube de Juiz de Fora</h3>
                <p className="text-sm text-blue-200 dark:text-zinc-400">Escola de aviação</p>
              </div>
            </div>
            <p className="text-blue-200 dark:text-zinc-400 text-sm">
              Excelência em formação aeronáutica desde 1938.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Acesso rápido</h4>
            <ul className="space-y-2 text-sm text-blue-200 dark:text-zinc-400">
              <li><Link to="/login" className="hover:text-white dark:hover:text-zinc-100">Entrar</Link></li>
              <li><Link to="/public-client-form" className="hover:text-white dark:hover:text-zinc-100">Cadastro</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Institucional</h4>
            <ul className="space-y-2 text-sm text-blue-200 dark:text-zinc-400">
              <li><a href="https://aeroclubejf.com.br/" target="_blank" rel="noreferrer" className="hover:text-white dark:hover:text-zinc-100">Site oficial</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-blue-800 dark:border-zinc-800 mt-8 pt-8 text-center text-sm text-blue-200 dark:text-zinc-400">
          <p>&copy; {new Date().getFullYear()} Aeroclube de Juiz de Fora. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
