import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import "./QuoteClientResponseBanner.css";

type QuoteResponse = {
  decision: "accepted" | "changes_requested" | "rejected";
  comment: string | null;
  responded_at: string;
};

type QuoteClientResponseBannerProps = {
  quoteId: string;
};

export function QuoteClientResponseBanner({ quoteId }: QuoteClientResponseBannerProps) {
  const [response, setResponse] = useState<QuoteResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadResponse() {
      const { data, error } = await supabase
        .from("quote_responses")
        .select("decision, comment, responded_at")
        .eq("quote_id", quoteId)
        .order("responded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cancelled && !error) {
        setResponse(data as QuoteResponse | null);
      }
    }

    void loadResponse();
    return () => {
      cancelled = true;
    };
  }, [quoteId]);

  if (!response) return null;
  const rejected = response.decision === "rejected";

  return (
    <aside
      className={
        rejected
          ? "quote-client-response quote-client-response--rejected"
          : "quote-client-response"
      }
      aria-label="Réponse du client"
    >
      <span className="quote-client-response__icon" aria-hidden="true">
        {rejected ? "×" : "✓"}
      </span>
      <div>
        <p className="quote-client-response__eyebrow">
          {rejected ? "Refus du client" : "Réponse du client"}
        </p>
        <h2>
          Devis {rejected ? "refusé" : "accepté"} le {formatDateTime(response.responded_at)}
        </h2>
        {response.comment ? (
          <blockquote>
            {rejected ? <strong>Motif du refus</strong> : null}
            <span>{response.comment}</span>
          </blockquote>
        ) : null}
      </div>
    </aside>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-BE", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}
