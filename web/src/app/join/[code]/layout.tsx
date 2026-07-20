import { Metadata } from 'next';

type Props = {
  params: Promise<{ code: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const normalizedCode = code?.toUpperCase();
  
  return {
    title: `Rejoindre ${normalizedCode} - Kotiz`,
    description: `Rejoignez l'association ${normalizedCode} sur Kotiz`,
    manifest: `/manifest/${normalizedCode}`,
  };
}

export default function JoinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
