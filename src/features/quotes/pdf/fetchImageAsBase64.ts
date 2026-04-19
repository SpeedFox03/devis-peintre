/**
 * Récupère une image distante et la retourne en base64 data-URL,
 * prêt à être passé à pdfmake ({ image: dataUrl }).
 *
 * Retourne null si l'URL est vide ou si le fetch échoue,
 * pour que les thèmes PDF tombent sur le fallback texte.
 */
export async function fetchImageAsBase64(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;

  try {
    const response = await fetch(url);

    if (!response.ok) return null;

    const blob = await response.blob();

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
