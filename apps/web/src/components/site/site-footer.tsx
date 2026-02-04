export function SiteFooter() {
  return (
    <footer className="footer">
      <div>
        <strong>SkillBound</strong>
        <span>OSRS progression tracker - 2026</span>
      </div>
      <div className="footer-links">
        <a href="/api/health">Status</a>
        <a href="/api/content/latest">Content</a>
        <a href="/api/characters/lookup">Lookup</a>
      </div>
    </footer>
  );
}
