import CheckoutReturnPage from "../CheckoutReturnPage";

export default function CheckoutCancelPage() {
  return (
    <CheckoutReturnPage
      eyebrow="Checkout return"
      title="Checkout not completed"
      message="No Release Signal subscription change has been made. You can return to the application and try again later."
    />
  );
}
