import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AnnouncementContent from './AnnouncementContent';

describe('AnnouncementContent', () => {
  it('renders Markdown and LaTeX while leaving raw HTML disabled', () => {
    const markup = renderToStaticMarkup(
      <AnnouncementContent>
        {'## Update\n\nInline math: $E = mc^2$\n\n<script>alert(1)</script>'}
      </AnnouncementContent>,
    );

    expect(markup).toContain('<h2>Update</h2>');
    expect(markup).toContain('class="katex"');
    expect(markup).not.toContain('<script>');
  });
});
