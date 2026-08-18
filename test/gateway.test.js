const assert = require('node:assert/strict');
const test = require('node:test');
const { geminiContents, geminiTools, normalizeGemini, systemInstruction } = require('../server/gemini-gateway.js');


test('gateway converts Spencer messages and tools into Gemini content shapes', () => {
  const messages = [
    { role: 'system', content: 'Be careful.' },
    { role: 'user', content: 'Read a file.' },
    { role: 'assistant', content: '', tool_calls: [{ function: { name: 'read_file', arguments: '{"path":"README.md"}' } }] },
    { role: 'tool', name: 'read_file', tool_call_id: 'call-1', content: '1: title' },
  ];
  const contents = geminiContents(messages);
  assert.equal(contents[0].role, 'user');
  assert.equal(contents[1].role, 'model');
  assert.deepEqual(contents[1].parts[0].functionCall.args, { path: 'README.md' });
  assert.equal(contents[2].parts[0].functionResponse.name, 'read_file');
  assert.equal(systemInstruction(messages).parts[0].text, 'Be careful.');

  const tools = geminiTools([{ function: { name: 'read_file', description: 'Read a file.', parameters: { type: 'object' } } }]);
  assert.equal(tools[0].functionDeclarations[0].name, 'read_file');
  assert.equal(tools[0].functionDeclarations[0].parameters.type, 'OBJECT');
});


test('gateway normalizes Gemini text and function-call parts', () => {
  const response = normalizeGemini({ candidates: [{ content: { parts: [{ text: 'I will inspect it.' }, { functionCall: { name: 'list_files', args: { depth: 2 } } }] } }] });
  assert.equal(response.choices[0].message.content, 'I will inspect it.');
  assert.equal(response.choices[0].message.tool_calls[0].function.name, 'list_files');
  assert.deepEqual(JSON.parse(response.choices[0].message.tool_calls[0].function.arguments), { depth: 2 });
});
