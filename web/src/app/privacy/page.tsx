import Link from 'next/link';

export const metadata = {
  title: 'Politique de confidentialité - Kotiz',
  description: 'Politique de confidentialité et gestion des données personnelles de l\'application Kotiz',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Politique de confidentialité</h1>
          <p className="text-gray-500 mb-8">Dernière mise à jour : 19 juillet 2026</p>

          <div className="prose prose-gray max-w-none">
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">1. Introduction</h2>
            <p className="text-gray-700 mb-4">
              Kotiz est une application de gestion de cotisations pour associations et syndicats de copropriétés. 
              Cette politique de confidentialité décrit comment nous collectons, utilisons et protégeons vos données personnelles.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">2. Données collectées</h2>
            <p className="text-gray-700 mb-2">Nous collectons les informations suivantes :</p>
            <ul className="list-disc list-inside text-gray-700 mb-4 space-y-1">
              <li><strong>Informations de compte</strong> : email, numéro de téléphone, mot de passe (crypté)</li>
              <li><strong>Informations de membre</strong> : nom, identifiant personnalisé (ex: numéro de villa)</li>
              <li><strong>Données de cotisations</strong> : historique des paiements mensuels et exceptionnels</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">3. Utilisation des données</h2>
            <p className="text-gray-700 mb-2">Vos données sont utilisées pour :</p>
            <ul className="list-disc list-inside text-gray-700 mb-4 space-y-1">
              <li>Gérer votre accès à l&apos;application</li>
              <li>Permettre à l'association de suivre les cotisations</li>
              <li>Générer des rapports et statistiques pour l'association</li>
              <li>Vous envoyer des notifications relatives à vos cotisations</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">4. Partage des données</h2>
            <p className="text-gray-700 mb-4">
              Vos données personnelles sont accessibles uniquement par les administrateurs de votre association. 
              Nous ne vendons ni ne partageons vos données avec des tiers à des fins commerciales.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">5. Sécurité des données</h2>
            <p className="text-gray-700 mb-4">
              Nous mettons en œuvre des mesures de sécurité appropriées pour protéger vos données :
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-4 space-y-1">
              <li>Chiffrement des mots de passe (bcrypt)</li>
              <li>Connexions sécurisées (HTTPS)</li>
              <li>Authentification par token JWT</li>
              <li>Isolation des données entre associations</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">6. Conservation des données</h2>
            <p className="text-gray-700 mb-4">
              Vos données de compte sont conservées tant que votre compte est actif. 
              L'historique des cotisations est conservé pour les besoins comptables de l'association, 
              même après la suppression de votre compte.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">7. Vos droits</h2>
            <p className="text-gray-700 mb-2">Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul className="list-disc list-inside text-gray-700 mb-4 space-y-1">
              <li><strong>Droit d&apos;accès</strong> : consulter vos données via l&apos;application</li>
              <li><strong>Droit de rectification</strong> : modifier vos informations de profil</li>
              <li><strong>Droit à l&apos;effacement</strong> : supprimer votre compte (voir section 8)</li>
              <li><strong>Droit à la portabilité</strong> : exporter vos données de cotisations</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">8. Suppression de compte</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-gray-700 mb-2">
                Vous pouvez demander la suppression de votre compte de deux manières :
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li><strong>Depuis l&apos;application</strong> : Menu Paramètres → &quot;Supprimer mon compte&quot;</li>
                <li><strong>Sans l&apos;application</strong> : <Link href="/delete-account" className="text-blue-600 hover:underline">Formulaire de demande en ligne</Link></li>
              </ul>
              <p className="text-gray-700 mt-3">
                <strong>Important :</strong> Lors de la suppression, vos informations personnelles (email, téléphone, mot de passe) 
                sont effacées. L'historique de vos cotisations est conservé de manière anonymisée pour la comptabilité de l'association.
              </p>
              <p className="text-gray-700 mt-2">
                <strong>Délai de traitement :</strong> 30 jours maximum
              </p>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">9. Contact</h2>
            <p className="text-gray-700 mb-4">
              Pour toute question concernant vos données personnelles, contactez-nous à :<br />
              <a href="mailto:mikouei2@gmail.com" className="text-blue-600 hover:underline">mikouei2@gmail.com</a>
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">10. Modifications</h2>
            <p className="text-gray-700 mb-4">
              Cette politique peut être mise à jour. Les modifications seront notifiées via l&apos;application 
              ou par email. La date de dernière mise à jour est indiquée en haut de cette page.
            </p>
          </div>
        </div>

        <div className="text-center mt-6 space-x-4">
          <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm">
            Accueil
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
