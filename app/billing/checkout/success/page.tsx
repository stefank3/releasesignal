import CheckoutReturnPage from "../CheckoutReturnPage";

export default function CheckoutSuccessPage() {
  return (
    <CheckoutReturnPage
      eyebrow="Checkout return"
      title="Payment submitted"
      message="Your payment was submitted to the payment provider. Your Release Signal subscription will update after payment verification."
    />
  );
}
