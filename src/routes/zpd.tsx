import { createFileRoute, useCanGoBack, useRouter } from "@tanstack/react-router";
import { zpdInfo, zpdReturnPlan } from "@/lib/zpd-info";

export const Route = createFileRoute("/zpd")({
  head: () => ({
    meta: [{ title: zpdInfo.documentTitle }, { name: "description", content: zpdInfo.description }],
  }),
  component: ZpdInfoPage,
});

function ZpdInfoPage() {
  const router = useRouter();
  const canGoBack = useCanGoBack();

  return (
    <main className="zpd-page">
      <div className="zpd-return-bar">
        <button
          type="button"
          className="zpd-return"
          onClick={() => {
            if (zpdReturnPlan({ canGoBack: () => canGoBack }) === "back") {
              router.history.back();
              return;
            }
            void router.navigate({ to: "/" });
          }}
        >
          Return
        </button>
      </div>
      <section className="zpd-hero">
        <div>
          <p className="zpd-kicker">{zpdInfo.kicker}</p>
          <h1 className="zpd-title">{zpdInfo.title}</h1>
          <div className="zpd-copy">
            {zpdInfo.lede.map((paragraph) => (
              <p key={paragraph} className="zpd-lede">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
        <div className="zpd-lockup">
          <img
            src={zpdInfo.image.src}
            alt={zpdInfo.image.alt}
            width={zpdInfo.image.width}
            height={zpdInfo.image.height}
          />
        </div>
      </section>
    </main>
  );
}
