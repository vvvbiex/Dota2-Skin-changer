// Ordered nodes keep repeated keys and source offsets for surgical replacements.
export function parseKV(text) {
  let pos = 0
  const length = text.length
  const trivia = /(?:[\s\uFEFF]+|\/\/[^\r\n]*|\/\*[\s\S]*?\*\/)+/y
  const quoted = /"((?:[^"\\]|\\[\s\S])*)"/y
  const bare = /[^\s"{}]+/y
  const fail = message => { throw SyntaxError(message + ' (posição ' + pos + ')') }
  function skip() {
    trivia.lastIndex = pos
    if (trivia.test(text)) pos = trivia.lastIndex
  }
  function token() {
    const re = text[pos] === '"' ? quoted : bare
    re.lastIndex = pos
    const match = re.exec(text)
    if (!match) fail('Token KV1 inválido')
    pos = re.lastIndex
    return re === bare ? match[0] : match[1].replace(/\\(["\\])/g, '$1')
  }
  function block(depth) {
    if (depth > 256) fail('Blocos KV1 aninhados em excesso')
    const nodes = []
    while (true) {
      skip()
      if (pos === length || text[pos] === '}') break
      const start = pos
      const key = token()
      skip()
      const valueStart = pos
      let value
      if (text[pos] === '{') {
        pos++
        value = block(depth + 1)
        if (text[pos] !== '}') fail('Falta fechar o bloco ' + key)
        pos++
      } else {
        value = token()
      }
      let end = pos
      skip()
      let condition
      if (text[pos] === '[') {
        end = text.indexOf(']', pos) + 1
        if (!end) fail('Condição incompleta')
        condition = text.slice(pos, end)
        pos = end
      }
      nodes.push({ key, value, start, valueStart, end, condition })
    }
    return nodes
  }
  const root = block(0)
  if (pos !== length) fail('Fechamento KV1 inesperado')
  return root
}

export const children = node => Array.isArray(node?.value) ? node.value : []
export const find = (nodes, key) => nodes.find(node => node.key === key)
export const scalar = (nodes, key) => {
  const value = find(nodes, key)?.value
  return typeof value === 'string' ? value : undefined
}

export function spliceText(text, edits) {
  let last = 0
  const chunks = []
  for (const { start, end, replacement } of edits.sort((a, b) => a.start - b.start)) {
    if (start < last) throw Error('Alterações KV1 sobrepostas.')
    chunks.push(text.slice(last, start), replacement)
    last = end
  }
  chunks.push(text.slice(last))
  return chunks.join('')
}
