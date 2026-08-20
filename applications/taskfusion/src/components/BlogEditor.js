// src/components/BlogEditor.js
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { uploadBlogImage } from '../services/blogAssets';

const toolbarButtonStyle = (active, disabled) => ({
  padding: '5px 9px',
  fontSize: 12,
  fontWeight: 500,
  border: '0.5px solid var(--mv-border)',
  borderRadius: 6,
  background: active ? 'var(--mv-color-primary)' : 'var(--mv-bg)',
  color: active ? 'var(--mv-color-primary-contrast)' : 'var(--mv-text-muted)',
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.5 : 1,
});

// Extension set matches platform-services/blog-service/lib/sanitize.js's
// server-side allowlist 1:1 — anything the editor lets someone create
// that the server would later strip is a silent-content-loss bug, not
// just a nicety. Heading levels capped at 2-4 (h1 is the post title
// itself, styled separately, not part of body content).
const extensions = [
  StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
  Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
  Image,
];

// postId gates image upload — a post needs to exist (Save clicked at
// least once) before an asset-service object key (blog/{postId}/...)
// can be minted for it. Simpler than minting a client-side id up front,
// and avoids orphaned uploads for a post that's never actually saved.
const BlogEditor = ({ content, onChange, postId }) => {
  const { t } = useTranslation('blog');
  const fileInputRef = useRef(null);

  const editor = useEditor({
    extensions,
    content: content || '',
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  // Resyncs when `content` changes out from under us — initial async
  // load, or the server's sanitized version coming back after a save —
  // without fighting the user's own in-progress typing the rest of the
  // time (only fires when the two actually diverge).
  useEffect(() => {
    if (editor && content !== undefined && content !== editor.getHTML()) {
      editor.commands.setContent(content || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, editor]);

  if (!editor) return null;

  const handleImageFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !postId) return;
    try {
      const url = await uploadBlogImage(postId, file);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch (err) {
      window.alert(t('form.uploadImageError', { error: err.message }));
    }
  };

  const setLink = () => {
    const url = window.prompt(t('editor.linkPrompt'), editor.getAttributes('link').href || 'https://');
    if (url === null) return;
    if (!url) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div style={{ border: '0.5px solid var(--mv-border)', borderRadius: 8 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          padding: 8,
          borderBottom: '0.5px solid var(--mv-border)',
        }}
      >
        <button type="button" style={toolbarButtonStyle(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}>
          {t('editor.bold')}
        </button>
        <button type="button" style={toolbarButtonStyle(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}>
          {t('editor.italic')}
        </button>
        <button type="button" style={toolbarButtonStyle(editor.isActive('strike'))} onClick={() => editor.chain().focus().toggleStrike().run()}>
          {t('editor.strike')}
        </button>
        <button
          type="button"
          style={toolbarButtonStyle(editor.isActive('heading', { level: 2 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          {t('editor.heading2')}
        </button>
        <button
          type="button"
          style={toolbarButtonStyle(editor.isActive('heading', { level: 3 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          {t('editor.heading3')}
        </button>
        <button
          type="button"
          style={toolbarButtonStyle(editor.isActive('bulletList'))}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          {t('editor.bulletList')}
        </button>
        <button
          type="button"
          style={toolbarButtonStyle(editor.isActive('orderedList'))}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          {t('editor.orderedList')}
        </button>
        <button
          type="button"
          style={toolbarButtonStyle(editor.isActive('blockquote'))}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          {t('editor.blockquote')}
        </button>
        <button
          type="button"
          style={toolbarButtonStyle(editor.isActive('codeBlock'))}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          {t('editor.codeBlock')}
        </button>
        <button type="button" style={toolbarButtonStyle(editor.isActive('link'))} onClick={setLink}>
          {t('editor.link')}
        </button>
        <button
          type="button"
          title={postId ? undefined : t('form.saveFirstForImages')}
          disabled={!postId}
          style={toolbarButtonStyle(false, !postId)}
          onClick={() => postId && fileInputRef.current?.click()}
        >
          {t('editor.image')}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} />
      </div>
      <div style={{ padding: 12, minHeight: 240, fontSize: 14, color: 'var(--mv-text)' }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default BlogEditor;
