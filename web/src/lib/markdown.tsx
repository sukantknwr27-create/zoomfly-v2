import React from 'react'

// A deliberately small Markdown renderer for our own legal text: #, ##, ### headings, paragraphs, "-" and "1." lists,
// **bold**, *italic*, [links](url). Everything is rendered as React text (never raw HTML), so nothing can inject markup.
function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
  let last = 0, m: RegExpExecArray | null, i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) out.push(<strong key={`${key}-${i++}`}>{tok.slice(2, -2)}</strong>)
    else if (tok.startsWith('*')) out.push(<em key={`${key}-${i++}`}>{tok.slice(1, -1)}</em>)
    else {
      const [, label, href] = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok)!
      const safe = /^(\/|https:\/\/|mailto:)/.test(href) ? href : '#'
      out.push(<a key={`${key}-${i++}`} href={safe}>{label}</a>)
    }
    last = m.index + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function renderMarkdown(md: string): React.ReactNode {
  const lines = md.replace(/\r/g, '').split('\n')
  const blocks: React.ReactNode[] = []
  let para: string[] = [], list: { ordered: boolean; items: string[] } | null = null, k = 0
  const flushPara = () => { if (para.length) { blocks.push(<p key={k++}>{inline(para.join(' '), `p${k}`)}</p>); para = [] } }
  const flushList = () => {
    if (!list) return
    const items = list.items.map((it, j) => <li key={j}>{inline(it, `l${k}-${j}`)}</li>)
    blocks.push(list.ordered ? <ol key={k++} className="plain-list">{items}</ol> : <ul key={k++} className="plain-list">{items}</ul>)
    list = null
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    let m: RegExpMatchArray | null
    if (!line.trim()) { flushPara(); flushList(); continue }
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      flushPara(); flushList()
      const level = m[1].length
      const Tag = (level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3') as 'h1' | 'h2' | 'h3'
      blocks.push(<Tag key={k++}>{inline(m[2], `h${k}`)}</Tag>)
    } else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      flushPara()
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] } }
      list.items.push(m[1])
    } else if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) {
      flushPara()
      if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] } }
      list.items.push(m[1])
    } else {
      flushList()
      para.push(line.trim())
    }
  }
  flushPara(); flushList()
  return <>{blocks}</>
}
