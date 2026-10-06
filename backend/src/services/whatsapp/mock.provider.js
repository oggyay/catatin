export const mockProvider = {
  name: 'mock',
  async send(to, message) {
    console.log('\n================ [MOCK WA SEND] ================');
    console.log('To     :', to);
    console.log('Message:', message);
    console.log('================================================\n');
    return { ok: true, provider: 'mock' };
  },
};
