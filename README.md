----------------------------------------------------
**V. 1.48.2 - Burger Menu Online** - 25/07/2026
----------------------------------------------------
Aplicadas otimizacoes para acelerar o carregamento da pagina.

Otimizações aplicadas:
- getAllMenuItems e getAllCategories agora selecionam colunas explícitas em vez de select("*").
- No Index.tsx, getProfile e getRecompensasCliente rodam em paralelo via Promise.all quando o telefone já está disponível no currentUser, evitando a espera sequencial.
