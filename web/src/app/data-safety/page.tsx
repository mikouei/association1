import Link from 'next/link';

export const metadata = {
  title: 'Data Safety - AssocManager',
  description: 'Informations sur la collecte et la gestion des données pour Google Play Store',
};

export default function DataSafetyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Safety</h1>
          <p className="text-gray-500 mb-8">Informations pour Google Play Store - AssocManager</p>

          <div className="space-y-8">
            {/* Section 1: Collecte des données */}
            <section className="border-b border-gray-200 pb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">1</span>
                Données collectées
              </h2>
              
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Informations personnelles</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-gray-200">
                        <td className="py-2 text-gray-600">Email</td>
                        <td className="py-2 text-gray-900">Collecté pour l&apos;authentification</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="py-2 text-gray-600">Téléphone</td>
                        <td className="py-2 text-gray-900">Optionnel, pour identification alternative</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-gray-600">Nom</td>
                        <td className="py-2 text-gray-900">Pour identification dans l'association</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Données financières</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr>
                        <td className="py-2 text-gray-600">Historique des paiements</td>
                        <td className="py-2 text-gray-900">Cotisations mensuelles et exceptionnelles</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Section 2: Utilisation des données */}
            <section className="border-b border-gray-200 pb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">2</span>
                Utilisation des données
              </h2>
              
              <ul className="space-y-3">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-700">Fonctionnalité de l&apos;application (authentification, gestion des cotisations)</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-700">Gestion du compte utilisateur</span>
                </li>
              </ul>

              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800 font-medium">Nous ne faisons PAS :</p>
                <ul className="text-sm text-red-700 mt-2 space-y-1">
                  <li>• Vente de données à des tiers</li>
                  <li>• Publicité ciblée</li>
                  <li>• Suivi de localisation</li>
                  <li>• Partage avec des réseaux sociaux</li>
                </ul>
              </div>
            </section>

            {/* Section 3: Partage des données */}
            <section className="border-b border-gray-200 pb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="w-8 h-8 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">3</span>
                Partage des données
              </h2>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-gray-700">
                  <strong>Accès limité :</strong> Vos données sont partagées uniquement avec les administrateurs 
                  de votre association pour la gestion des cotisations.
                </p>
              </div>
            </section>

            {/* Section 4: Sécurité */}
            <section className="border-b border-gray-200 pb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">4</span>
                Sécurité des données
              </h2>
              
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
                  Données chiffrées en transit (HTTPS/TLS)
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
                  Mots de passe hashés (bcrypt)
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
                  Authentification sécurisée par token JWT
                </li>
              </ul>
            </section>

            {/* Section 5: Suppression */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">5</span>
                Suppression des données
              </h2>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-gray-700 mb-3">
                  <strong>Vous pouvez demander la suppression de votre compte :</strong>
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-blue-100">
                    <h4 className="font-medium text-gray-900 mb-2">Dans l&apos;application</h4>
                    <p className="text-sm text-gray-600">Paramètres → &quot;Supprimer mon compte&quot;</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-blue-100">
                    <h4 className="font-medium text-gray-900 mb-2">Sans l&apos;application</h4>
                    <Link href="/delete-account" className="text-sm text-blue-600 hover:underline">
                      Formulaire de demande en ligne →
                    </Link>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-4">
                  <strong>Note :</strong> L'historique des cotisations est conservé de manière anonymisée 
                  pour les obligations comptables de l'association.
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  <strong>Délai de traitement :</strong> 30 jours maximum
                </p>
              </div>
            </section>
          </div>
        </div>

        {/* Résumé pour Play Console */}
        <div className="bg-white rounded-xl shadow-lg p-8 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Résumé pour Google Play Console</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left p-3 border">Question</th>
                  <th className="text-left p-3 border">Réponse</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-3 border text-gray-700">L'application collecte-t-elle des données ?</td>
                  <td className="p-3 border text-gray-900">Oui</td>
                </tr>
                <tr>
                  <td className="p-3 border text-gray-700">Types de données</td>
                  <td className="p-3 border text-gray-900">Email, téléphone, nom, historique de paiements</td>
                </tr>
                <tr>
                  <td className="p-3 border text-gray-700">Données partagées avec des tiers ?</td>
                  <td className="p-3 border text-gray-900">Non</td>
                </tr>
                <tr>
                  <td className="p-3 border text-gray-700">Données chiffrées en transit ?</td>
                  <td className="p-3 border text-gray-900">Oui (HTTPS)</td>
                </tr>
                <tr>
                  <td className="p-3 border text-gray-700">L'utilisateur peut demander la suppression ?</td>
                  <td className="p-3 border text-gray-900">Oui (dans l'app et via formulaire web)</td>
                </tr>
                <tr>
                  <td className="p-3 border text-gray-700">URL de la politique de confidentialité</td>
                  <td className="p-3 border text-blue-600">
                    <Link href="/privacy" className="hover:underline">/privacy</Link>
                  </td>
                </tr>
                <tr>
                  <td className="p-3 border text-gray-700">URL du formulaire de suppression</td>
                  <td className="p-3 border text-blue-600">
                    <Link href="/delete-account" className="hover:underline">/delete-account</Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-center mt-6 space-x-4">
          <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm">
            Accueil
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/privacy" className="text-blue-600 hover:text-blue-800 text-sm">
            Politique de confidentialité complète
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/delete-account" className="text-blue-600 hover:text-blue-800 text-sm">
            Supprimer mon compte
          </Link>
        </div>
      </div>
    </div>
  );
}
