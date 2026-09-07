// Test-only launch/interactive nodes. No figure classes or article rewriting.
const panel = `<!doctype html><html lang="en"><meta charset="utf-8">
<body style="font:16px system-ui;padding:20px;background:#fff;color:#172033">
<h2>Interactive content stays interactive</h2>
<button onclick="document.getElementById('count').textContent=Number(document.getElementById('count').textContent)+1">Increment counter</button>
<p>Count: <output id="count">0</output></p></body></html>`;
export default {
  name: 'pretext-content-detection-demo',
  directives: [
    { name: 'pretext-widget', run: () => [{ type: 'pretext-widget' }] },
    {
      name: 'demo-panel',
      run: () => [
        {
          type: 'iframe',
          title: 'Automatic detection interactive test',
          height: 200,
          src: `data:text/html;base64,${Buffer.from(panel).toString('base64')}`,
        },
      ],
    },
    {
      name: 'demo-unknown',
      run: () => [
        { type: 'example-unregistered-output', value: 'Unknown output content is retained.' },
      ],
    },
  ],
};
