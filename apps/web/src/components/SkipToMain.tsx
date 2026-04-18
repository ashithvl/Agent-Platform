/** First focusable control: jumps to `#main-content` (provide that id on the page main landmark). */
export function SkipToMain() {
  return (
    <a href="#main-content" className="skip-link">
      Skip to main content
    </a>
  );
}
