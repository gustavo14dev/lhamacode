-- Corrigir permissão da tabela user_sessions
-- Execute isso no SQL Editor do Supabase

-- Remover políticas existentes
DROP POLICY IF EXISTS "Users can manage own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Admin can view all sessions" ON user_sessions;

-- Criar política correta (sem verificar auth.uid() para insert)
CREATE POLICY "Users can manage own sessions" ON user_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Política para insert/update sem verificação (permite criar própria sessão)
CREATE POLICY "Users can insert own sessions" ON user_sessions
    FOR INSERT WITH CHECK (true);

-- Política para update (permite atualizar própria sessão)
CREATE POLICY "Users can update own sessions" ON user_sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- Política para select (permite ver própria sessão)
CREATE POLICY "Users can view own sessions" ON user_sessions
    FOR SELECT USING (auth.uid() = user_id);

-- Política admin para visualizar todas
CREATE POLICY "Admin can view all sessions" ON user_sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.email = 'gustavo14dev@gmail.com'
        )
    );
