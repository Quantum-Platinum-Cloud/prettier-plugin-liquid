import { expect } from 'chai';
import { toLiquidHtmlAST, LiquidHtmlNode, walk } from './ast';
import { LiquidHTMLASTParsingError, deepGet } from './utils';

describe('Unit: toLiquidHtmlAST', () => {
  it('should transform a basic Liquid Drop into a LiquidDrop', () => {
    const ast = toLiquidHtmlAST('{{ name }}');
    expectPath(ast, 'children.0').to.exist;
    expectPath(ast, 'children.0.type').to.eql('LiquidDrop');
    expectPath(ast, 'children.0.markup').to.eql(' name ');
    expectPosition(ast, 'children.0');
    expectParentNodes(ast);
  });

  it('should transform a basic Liquid Tag into a LiquidTag', () => {
    const ast = toLiquidHtmlAST('{% name %}{% if -%}{%- endif %}');
    expectPath(ast, 'children.0').to.exist;
    expectPath(ast, 'children.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.name').to.eql('name');
    expectPath(ast, 'children.0.markup').to.eql('');
    expectPath(ast, 'children.0.children').to.be.undefined;
    expectPath(ast, 'children.1.whitespaceStart').to.eql('');
    expectPath(ast, 'children.1.whitespaceEnd').to.eql('-');
    expectPath(ast, 'children.1.delimiterWhitespaceStart').to.eql('-');
    expectPath(ast, 'children.1.delimiterWhitespaceEnd').to.eql('');
    expectPosition(ast, 'children.0');
    expectParentNodes(ast);
  });

  it('should parse a basic text node into a TextNode', () => {
    const ast = toLiquidHtmlAST('Hello world!');
    expectPath(ast, 'children.0').to.exist;
    expectPath(ast, 'children.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.value').to.eql('Hello world!');
    expectPosition(ast, 'children.0');
    expectParentNodes(ast);
  });

  it('should parse HTML attributes', () => {
    const ast = toLiquidHtmlAST(
      `<img src="https://1234" loading='lazy' disabled checked="">`,
    );
    expectPath(ast, 'children.0').to.exist;
    expectPath(ast, 'children.0.type').to.eql('HtmlVoidElement');
    expectPath(ast, 'children.0.name').to.eql('img');
    expectPath(ast, 'children.0.attributes.0.name').to.eql('src');
    expectPath(ast, 'children.0.attributes.0.value.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.attributes.0.value.0.value').to.eql(
      'https://1234',
    );
    expectPath(ast, 'children.0.attributes.1.name').to.eql('loading');
    expectPath(ast, 'children.0.attributes.1.value.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.attributes.1.value.0.value').to.eql('lazy');
    expectPath(ast, 'children.0.attributes.2.name').to.eql('disabled');
    expectPath(ast, 'children.0.attributes.3.name').to.eql('checked');
    expectPath(ast, 'children.0.attributes.3.value.0').to.be.undefined;

    expectPosition(ast, 'children.0');
    expectPosition(ast, 'children.0.attributes.0');
    expectPosition(ast, 'children.0.attributes.0.value.0');
    expectPosition(ast, 'children.0.attributes.1');
    expectPosition(ast, 'children.0.attributes.1.value.0');
    expectPosition(ast, 'children.0.attributes.2');
    expectParentNodes(ast);
  });

  it('should parse HTML tags with Liquid Drop names', () => {
    [
      `<{{ node_type }} src="https://1234" loading='lazy' disabled></{{node_type}}>`,
      `<{{ node_type }} src="https://1234" loading='lazy' disabled></{{ node_type }}>`,
      `<{{ node_type }} src="https://1234" loading='lazy' disabled></{{- node_type }}>`,
      `<{{ node_type }} src="https://1234" loading='lazy' disabled></{{- node_type -}}>`,
      `<{{ node_type -}} src="https://1234" loading='lazy' disabled></{{- node_type -}}>`,
      `<{{ node_type -}} src="https://1234" loading='lazy' disabled></{{- node_type -}}>`,
      `<{{- node_type -}} src="https://1234" loading='lazy' disabled></{{- node_type -}}>`,
    ].forEach((testCase) => {
      const ast = toLiquidHtmlAST(testCase);
      expectPath(ast, 'children.0').to.exist;
      expectPath(ast, 'children.0.type').to.eql('HtmlElement');
      expectPath(ast, 'children.0.name.type').to.eql('LiquidDrop');
      expectPath(ast, 'children.0.name.markup').to.eql(' node_type ');
      expectPath(ast, 'children.0.attributes.0.name').to.eql('src');
      expectPath(ast, 'children.0.attributes.0.value.0.type').to.eql(
        'TextNode',
      );
      expectPath(ast, 'children.0.attributes.0.value.0.value').to.eql(
        'https://1234',
      );
      expectPath(ast, 'children.0.attributes.1.name').to.eql('loading');
      expectPath(ast, 'children.0.attributes.1.value.0.type').to.eql(
        'TextNode',
      );
      expectPath(ast, 'children.0.attributes.1.value.0.value').to.eql('lazy');
      expectPath(ast, 'children.0.attributes.2.name').to.eql('disabled');
      expectParentNodes(ast);
    });
  });

  it('should throw when trying to close the wrong node', () => {
    const testCases = [
      '<a><div></a>',
      '<a>{% if condition %}</a>',
      '{% for a in b %}<div>{% endfor %}',
      '{% for a in b %}{% if condition %}{% endfor %}',
      '<{{ node_type }}><div></{{ node_type }}>',
      '<{{ node_type }}></{{ wrong_end_node }}>',
    ];
    for (const testCase of testCases) {
      expect(() => toLiquidHtmlAST(testCase)).to.throw(
        LiquidHTMLASTParsingError,
      );
    }
  });

  it('should parse html comments as raw', () => {
    const ast = toLiquidHtmlAST(`<!--\n  hello {{ product.name }}\n-->`);
    expectPath(ast, 'children.0.type').to.eql('HtmlComment');
    expectPath(ast, 'children.0.body').to.eql('\n  hello {{ product.name }}\n');
    expectPosition(ast, 'children.0');
    expectParentNodes(ast);
  });

  it('should parse script tags as raw', () => {
    const ast = toLiquidHtmlAST(
      `<script>\n  const a = {{ product | json }};\n</script>`,
    );
    expectPath(ast, 'children.0.type').to.eql('HtmlRawNode');
    expectPath(ast, 'children.0.name').to.eql('script');
    expectPath(ast, 'children.0.body').to.eql(
      '\n  const a = {{ product | json }};\n',
    );
    expectPosition(ast, 'children.0');
    expectParentNodes(ast);
  });

  it('should parse style tags as raw', () => {
    const ast = toLiquidHtmlAST(
      `<style>\n  :root { --bg: {{ settings.bg }}}\n</style>`,
    );
    expectPath(ast, 'children.0.type').to.eql('HtmlRawNode');
    expectPath(ast, 'children.0.name').to.eql('style');
    expectPath(ast, 'children.0.body').to.eql(
      '\n  :root { --bg: {{ settings.bg }}}\n',
    );
    expectPosition(ast, 'children.0');
    expectParentNodes(ast);
  });

  it('should parse liquid ifs as branches', () => {
    const ast = toLiquidHtmlAST(
      `{% if A %}A{% elsif B %}B{% else %}C{% endif %}`,
    );
    expectPath(ast, 'children.0').to.exist;
    expectPath(ast, 'children.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.name').to.eql('if');
    expectPath(ast, 'children.0.children.0').to.exist;
    expectPath(ast, 'children.0.children.0.type').to.eql('LiquidBranch');
    expectPath(ast, 'children.0.children.0.name').to.eql(null);
    expectPath(ast, 'children.0.children.0.markup').to.eql('');
    expectPath(ast, 'children.0.children.0.children.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.children.0.children.0.value').to.eql('A');

    expectPath(ast, 'children.0.children.1.type').to.eql('LiquidBranch');
    expectPath(ast, 'children.0.children.1.name').to.eql('elsif');
    expectPath(ast, 'children.0.children.1.markup').to.eql('B ');
    expectPath(ast, 'children.0.children.1.children.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.children.1.children.0.value').to.eql('B');

    expectPath(ast, 'children.0.children.2.type').to.eql('LiquidBranch');
    expectPath(ast, 'children.0.children.2.name').to.eql('else');
    expectPath(ast, 'children.0.children.2.children.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.children.2.children.0.value').to.eql('C');
    expectParentNodes(ast);
  });

  it('should parse liquid case as branches', () => {
    const ast = toLiquidHtmlAST(
      `{% case A %}{% when A %}A{% when B %}B{% else %}C{% endcase %}`,
    );
    expectPath(ast, 'children.0').to.exist;
    expectPath(ast, 'children.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.name').to.eql('case');

    // There's an empty child node between the case and first when. That's OK (?)
    // What if there's whitespace? I think that's a printer problem. If
    // there's freeform text we should somehow catch it.
    expectPath(ast, 'children.0.children.0').to.exist;
    expectPath(ast, 'children.0.children.0.type').to.eql('LiquidBranch');
    expectPath(ast, 'children.0.children.0.name').to.eql(null);

    expectPath(ast, 'children.0.children.1').to.exist;
    expectPath(ast, 'children.0.children.1.type').to.eql('LiquidBranch');
    expectPath(ast, 'children.0.children.1.name').to.eql('when');
    expectPath(ast, 'children.0.children.1.markup').to.eql('A ');
    expectPath(ast, 'children.0.children.1.children.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.children.1.children.0.value').to.eql('A');

    expectPath(ast, 'children.0.children.2.type').to.eql('LiquidBranch');
    expectPath(ast, 'children.0.children.2.name').to.eql('when');
    expectPath(ast, 'children.0.children.2.markup').to.eql('B ');
    expectPath(ast, 'children.0.children.2.children.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.children.2.children.0.value').to.eql('B');

    expectPath(ast, 'children.0.children.3.type').to.eql('LiquidBranch');
    expectPath(ast, 'children.0.children.3.name').to.eql('else');
    expectPath(ast, 'children.0.children.3.children.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.children.3.children.0.value').to.eql('C');
    expectParentNodes(ast);
  });

  function expectPath(ast: LiquidHtmlNode, path: string) {
    return expect(deepGet(path.split('.'), ast));
  }

  function expectPosition(ast: LiquidHtmlNode, path: string) {
    expectPath(ast, path + '.position.start').to.be.a('number');
    expectPath(ast, path + '.position.end').to.be.a('number');
  }

  function expectParentNodes(ast: LiquidHtmlNode) {
    walk(ast, (node, parentNode) => {
      if (typeof node === 'string') return;
      if (node.type === 'Document') return;
      expect(
        node.parentNode,
        `
          Expected ${node.type} node to have a parentNode of type ${parentNode.type}

          Expected parentNode of type ${parentNode.type}:
            ${sourceExcerpt(parentNode)}

          Actual parentNode of type ${node.parentNode.type}:
            ${sourceExcerpt(node.parentNode)}

          Actual node of type ${node.type}:
            ${sourceExcerpt(node)}
        `,
      ).to.eql(parentNode);
    });
  }

  function sourceExcerpt(node: LiquidHtmlNode) {
    return node.source.slice(node.position.start, node.position.end);
  }
});