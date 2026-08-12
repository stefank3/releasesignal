type CheckoutReturnPageProps = {
  eyebrow: string;
  title: string;
  message: string;
};

export default function CheckoutReturnPage({
  eyebrow,
  title,
  message,
}: CheckoutReturnPageProps) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(900px 360px at 50% -120px, rgba(217,119,87,0.12), rgba(31,30,27,0)), #1f1e1b",
        color: "#edeae3",
      }}
    >
      <section
        aria-labelledby="checkout-return-title"
        style={{
          width: "100%",
          maxWidth: 560,
          padding: 32,
          border: "1px solid rgba(237,234,227,0.14)",
          borderRadius: 16,
          background: "rgba(255,255,255,0.04)",
          boxShadow: "0 24px 70px rgba(0,0,0,0.22)",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#d97757",
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </p>

        <h1
          id="checkout-return-title"
          style={{ margin: "12px 0 0", fontSize: 36, lineHeight: 1.15 }}
        >
          {title}
        </h1>

        <p
          style={{
            margin: "16px 0 0",
            color: "#c4bfb4",
            fontSize: 16,
            lineHeight: 1.65,
          }}
        >
          {message}
        </p>

        <a
          href="/chat"
          style={{
            display: "inline-block",
            marginTop: 26,
            padding: "11px 16px",
            border: "1px solid #d97757",
            borderRadius: 10,
            background: "#d97757",
            color: "#1f1e1b",
            fontSize: 14,
            fontWeight: 900,
            textDecoration: "none",
          }}
        >
          Return to Release Signal
        </a>
      </section>
    </main>
  );
}
