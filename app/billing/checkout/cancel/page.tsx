import CheckoutReturnPage from "../CheckoutReturnPage";

export default function CheckoutCancelPage() {
  return (
    <CheckoutReturnPage
      eyebrow="Checkout return"
      title="Checkout not completed"
      message="Your checkout was not completed through this flow. You can return to Release Signal and try again later."
    />
  );
}
