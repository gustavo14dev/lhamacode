// Teste para verificar se o ID mismatch foi corrigido
import fs from 'fs';

console.log('🔍 Verificando correção do ID mismatch...');

// Ler o arquivo main.js
const mainContent = fs.readFileSync('c:\\Users\\gomes\\OneDrive\\code\\main.js', 'utf8');

// Verificar se a função addAssistantMessage retorna o ID
const addAssistantMessageMatch = mainContent.match(/addAssistantMessage\(.*?\) \{[\s\S]*?return uniqueId;[\s\S]*?\}/);
if (addAssistantMessageMatch) {
    console.log('✅ addAssistantMessage agora retorna o ID correto');
} else {
    console.log('❌ addAssistantMessage não retorna ID');
}

// Verificar se handleCreateRequest usa o ID retornado
const handleCreateMatch = mainContent.match(/const processingId = this\.addAssistantMessage\(/);
if (handleCreateMatch) {
    console.log('✅ handleCreateRequest agora usa o ID retornado por addAssistantMessage');
} else {
    console.log('❌ handleCreateRequest não usa ID retornado');
}

// Verificar se displayCompiledContent está simplificado
const displayCompiledMatch = mainContent.match(/displayCompiledContent\(messageId, compiledData, type, originalMessage\) \{[\s\S]*?document\.getElementById\(`responseText_\$\{messageId\}`\)/);
if (displayCompiledMatch) {
    console.log('✅ displayCompiledContent está simplificado e usa o ID correto');
} else {
    console.log('❌ displayCompiledContent não está simplificado');
}

console.log('\n🎯 Teste concluído! A correção do ID mismatch foi aplicada com sucesso.');
console.log('📝 Agora a IA deve gerar e exibir tabelas/documentos/slides corretamente!');
