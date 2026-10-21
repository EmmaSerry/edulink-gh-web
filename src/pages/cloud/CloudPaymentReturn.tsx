import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PlatformPaymentsService, KIND_LABEL } from "@services/cloud/PlatformPaymentsService";

/** Where Paystack sends the school after paying. Confirms the payment with
 *  the server, which grants access automatically. */
export function CloudPaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const reference = params.get("reference") || params.get("trxref") || "";
  const [state, setState] = useState<"checking" | "ok" | "failed">("checking");
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<string>("");

  useEffect(() => {
    if (!reference) {
      setState("failed");
      setMessage("No payment reference was found.");
      return;
    }
    let tries = 0;
    const run = async () => {
      try {
        const r = await PlatformPaymentsService.verify(reference);
        if (r.ok) {
          setKind(r.kind ?? "");
          setMessage(
            r.kind === "report_fees"
              ? `${r.quantity} report(s) unlocked.`
              : `${(r.quantity ?? 0).toLocaleString()} ${r.kind === "sms_tokens" ? "SMS" : "WhatsApp"} tokens added to your account.`,
          );
          setState("ok");
        } else if (tries < 3) {
          tries += 1;
          window.setTimeout(run, 3000); // Paystack can take a few seconds to confirm
        } else {
          setState("failed");
          setMessage(r.message ?? "The payment was not completed.");
        }
      } catch (e) {
        setState("failed");
        setMessage(e instanceof Error ? e.message : "Could not confirm the payment.");
      }
    };
    void run();
  }, [reference]);

  const back = kind === "report_fees" ? "/report-fees" : "/credits";

  return (
    <div className="d-flex justify-content-center pt-5">
      <div className="actrs-card p-4 text-center" style={{ maxWidth: 460 }}>
        {state === "checking" && (
          <>
            <div className="spinner-border text-primary mb-3" />
            <h1 className="h5">Confirming your payment...</h1>
            <p className="text-muted mb-0">Please wait - do not close this page.</p>
          </>
        )}
        {state === "ok" && (
          <>
            <div className="display-6 text-success mb-2"><i className="bi bi-check-circle-fill" /></div>
            <h1 className="h5">Payment successful</h1>
            <p className="mb-3">{message} {KIND_LABEL[kind] ? "" : ""}</p>
            <Link to={back} className="btn btn-primary">Continue</Link>
          </>
        )}
        {state === "failed" && (
          <>
            <div className="display-6 text-danger mb-2"><i className="bi bi-x-circle-fill" /></div>
            <h1 className="h5">Payment not confirmed</h1>
            <p className="text-muted">{message}</p>
            <p className="small text-muted">If money left your account, it will still be applied automatically within a few minutes. Reference: {reference || "-"}</p>
            <Link to="/credits" className="btn btn-outline-primary">Back</Link>
          </>
        )}
      </div>
    </div>
  );
}
