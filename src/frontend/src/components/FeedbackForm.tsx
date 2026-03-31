import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Star } from "lucide-react";
import { useState } from "react";
import { useActor } from "../hooks/useActor";

interface FeedbackFormProps {
  principal: string;
  problemContext: string;
  onClose?: () => void;
}

export default function FeedbackForm({
  principal,
  problemContext,
  onClose,
}: FeedbackFormProps) {
  const { actor: backend } = useActor();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!backend || rating === 0 || !comment.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await backend.submitFeedback(
        name.trim() || null,
        email.trim() || null,
        BigInt(rating),
        comment.trim(),
        problemContext,
      );
      setSubmitted(true);
    } catch (_err) {
      setError("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div
        className="flex flex-col items-center justify-center py-10 gap-3 text-center"
        data-ocid="feedback.success_state"
      >
        <div className="text-4xl">🎉</div>
        <p className="text-xl font-bold text-primary">
          Thank you for your feedback!
        </p>
        <p className="text-muted-foreground text-sm">
          Your response has been recorded.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => {
            setSubmitted(false);
            setRating(0);
            setComment("");
            setName("");
            setEmail("");
            onClose?.();
          }}
        >
          Close
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
      data-ocid="feedback.section"
    >
      {/* Star Rating */}
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-semibold">
          Rating <span className="text-destructive">*</span>
        </Label>
        <div className="flex gap-1" data-ocid="feedback.rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              className="focus:outline-none transition-transform hover:scale-110"
              aria-label={`Rate ${star} stars`}
            >
              <Star
                className="h-8 w-8"
                fill={(hovered || rating) >= star ? "#f59e0b" : "none"}
                stroke={(hovered || rating) >= star ? "#f59e0b" : "#94a3b8"}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Comment */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="feedback-comment" className="text-sm font-semibold">
          Comment <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="feedback-comment"
          placeholder="Tell us about your experience..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          required
          data-ocid="feedback.textarea"
          className="resize-none"
        />
      </div>

      {/* Name & Email (optional) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="feedback-name"
            className="text-sm font-medium text-muted-foreground"
          >
            Name <span className="text-xs">(optional)</span>
          </Label>
          <Input
            id="feedback-name"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-ocid="feedback.input"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="feedback-email"
            className="text-sm font-medium text-muted-foreground"
          >
            Email <span className="text-xs">(optional)</span>
          </Label>
          <Input
            id="feedback-email"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-ocid="feedback.input"
          />
        </div>
      </div>

      {/* Principal (read-only) */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">
          Your Principal ID
        </Label>
        <p className="text-xs font-mono text-muted-foreground bg-muted/40 rounded px-2 py-1 break-all">
          {principal}
        </p>
      </div>

      {error && (
        <p
          className="text-sm text-destructive"
          data-ocid="feedback.error_state"
        >
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={isSubmitting || rating === 0 || !comment.trim()}
        className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto self-end"
        data-ocid="feedback.submit_button"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          "Submit Feedback"
        )}
      </Button>
    </form>
  );
}
