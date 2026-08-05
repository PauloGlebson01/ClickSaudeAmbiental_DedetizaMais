// certificado.js - Módulo para geração de certificados técnicos
// Baseado no modelo do Certificado Desinsetiza - Novo_120412.docx

const CertificadoService = {
    /**
     * Gera um certificado técnico baseado em um serviço concluído
     * @param {number|string} servicoId - ID do serviço
     * @param {string} tipo - Tipo de certificado: 'desinsetizacao', 'desratizacao', 'descupinizacao'
     * @returns {Object} Dados do certificado gerado
     */
    gerarCertificado: function(servicoId, tipo) {
        // Busca o serviço
        const servico = DB.getById('servicos', servicoId);
        if (!servico) {
            throw new Error('Serviço não encontrado!');
        }

        // Busca o cliente
        const cliente = getCliente(servico.clienteId);
        if (!cliente) {
            throw new Error('Cliente não encontrado!');
        }

        // Busca a configuração da empresa
        const config = DB.getConfig();

        // Busca produtos utilizados (do serviço ou da OS vinculada)
        const produtos = this._buscarProdutosUtilizados(servico);

        // Busca métodos empregados e pragas alvo
        const metodos = this._buscarMetodosEmpregados(servico);

        // Dados da empresa prestadora
        const empresaPrestadora = {
            nome: config.empresa.nome || 'S. AUGUSTA DA SILVA (Click Saúde Ambiental)',
            cnpj: config.empresa.cnpj || '48.922.299/0001-68',
            alvaraSanitario: '3142.6700/2025',
            licencaAmbiental: '110/2024',
            endereco: config.empresa.endereco || 'rua Dona Rosa da Fonseca, 154, Prado, Maceió/AL'
        };

        // Responsáveis técnicos
        const responsaveis = {
            tecnico: {
                nome: 'Weverton Jonatha dos Santos da Silva',
                registro: 'CRF/AL 3536',
                atuacao: 'Farmacêutico'
            },
            operacional: {
                nome: 'Gleidson A. S. dos Santos',
                registro: '-',
                atuacao: 'Resp. Operacional'
            }
        };

        // Telefone de emergência
        const telefoneEmergencia = '0800 148110';

        // Observações padrão do certificado
        const observacoesPadrao = this._gerarObservacoesPorTipo(tipo, produtos);

        // Constroi o objeto do certificado
        const certificado = {
            id: 'cert_' + Date.now(),
            servicoId: servico.id,
            clienteId: cliente.id,
            tipo: tipo,
            dataEmissao: new Date().toISOString(),
            dataServico: servico.data,
            dataValidade: this._calcularDataValidade(servico.data, tipo),
            
            // Dados do cliente
            cliente: {
                nome: cliente.tipoCliente === 'cnpj' ? (cliente.nomeFantasia || cliente.razaoSocial || cliente.nome) : cliente.nome,
                razaoSocial: cliente.razaoSocial || '',
                cnpjCpf: cliente.documento || 'N/A',
                endereco: cliente.endereco || 'N/A',
                telefone: cliente.telefone || 'N/A',
                tipo: cliente.tipoCliente || 'cpf'
            },

            // Dados da empresa prestadora
            prestadora: empresaPrestadora,

            // Responsáveis
            responsaveis: responsaveis,

            // Produtos utilizados
            produtos: produtos,

            // Métodos empregados
            metodos: metodos,

            // Observações
            observacoes: observacoesPadrao,

            // Telefone de emergência
            telefoneEmergencia: telefoneEmergencia,

            // Status do certificado
            status: 'ativo',
            criadoEm: new Date().toISOString()
        };

        // Salva o certificado
        DB.add('certificados', certificado);

        return certificado;
    },

    /**
     * Busca produtos utilizados no serviço
     */
    _buscarProdutosUtilizados: function(servico) {
        const produtos = [];
        
        // Verifica se o serviço tem produtos vinculados
        if (servico.produtosUtilizados && servico.produtosUtilizados.length > 0) {
            return servico.produtosUtilizados;
        }

        // Busca OS vinculada ao serviço
        const ordens = DB.getAll('ordens');
        const osVinculada = ordens.find(o => o.servicoId === servico.id);
        
        if (osVinculada && osVinculada.inseticidasUtilizados) {
            return osVinculada.inseticidasUtilizados.map(ins => ({
                nome: ins.nome || '',
                registroMs: ins.registro || '',
                grupoQuimico: ins.gQuimico || '',
                principioAtivo: ins.pAtivo || '',
                concentracao: ins.porcentagem || '',
                tratamento: ins.tratamento || 'Sintomático',
                quantidade: ins.quantidade || 1,
                unidade: ins.unidade || ''
            }));
        }

        // Produtos padrão por tipo de serviço
        const produtosPadrao = {
            'Desinsetização': [
                { nome: 'Bifentol', registroMs: '32398.0027', grupoQuimico: 'Piretroide', principioAtivo: 'Bifentrina', concentracao: '1%', tratamento: 'Sintomático' },
                { nome: 'Baramid', registroMs: '33308.0014', grupoQuimico: 'Amidino hidrazona', principioAtivo: 'Hidrometil-nona', concentracao: '2%', tratamento: 'Sintomático' },
                { nome: 'Formifim', registroMs: '323980002', grupoQuimico: 'Neonicotinoide', principioAtivo: 'Imidacloprid', concentracao: '0,015%', tratamento: 'Sintomático' }
            ],
            'Desratização': [
                { nome: 'Raticida Blocos', registroMs: 'N/A', grupoQuimico: 'Anticoagulante', principioAtivo: 'Brodifacoum', concentracao: '0,005%', tratamento: 'Iscas' },
                { nome: 'Raticida Pó', registroMs: 'N/A', grupoQuimico: 'Anticoagulante', principioAtivo: 'Coumatetralyl', concentracao: '0,0375%', tratamento: 'Pó de contato' }
            ],
            'Descupinização': [
                { nome: 'Cupinicida Líquido', registroMs: 'N/A', grupoQuimico: 'Inseticida', principioAtivo: 'Imidacloprid', concentracao: '2%', tratamento: 'Barreira líquida' },
                { nome: 'Cupinicida Solvente', registroMs: 'N/A', grupoQuimico: 'Inseticida', principioAtivo: 'Fipronil', concentracao: '0,15%', tratamento: 'Barreira solvente' }
            ]
        };

        return produtosPadrao[servico.tipo] || [];
    },

    /**
     * Busca métodos empregados no serviço
     */
    _buscarMetodosEmpregados: function(servico) {
        // Busca OS vinculada
        const ordens = DB.getAll('ordens');
        const osVinculada = ordens.find(o => o.servicoId === servico.id);

        let metodos = [];
        let pragasAlvo = [];

        if (osVinculada) {
            if (osVinculada.metodosEmpregados) {
                metodos = osVinculada.metodosEmpregados;
            }
            if (osVinculada.pragasAlvo) {
                pragasAlvo = osVinculada.pragasAlvo;
            }
        }

        // Métodos padrão por tipo
        const metodosPadrao = {
            'Desinsetização': {
                metodos: 'Pulverização convencional em superfície (rodapé interno, externo, ralos e caixa de esgoto) de forma a manter um efeito residual, utilizando bomba de compressão prévia e bico-leque. Aplicação com gel baraticida embaixo das pias, eletrodomésticos e armários. Aplicação com gel formicida em pontos específicos do ambiente.',
                pragas: 'Escorpiões (Tityus serrulatus, Tityus stigmurus), Baratas de esgoto (Periplaneta americana), Baratas francesinha (Blattella germanica), Formigas doceiras'
            },
            'Desratização': {
                metodos: 'Instalação de pontos de monitoramento com iscas raticidas em túneis e portas iscas, distribuídos estrategicamente no perímetro do imóvel. Realização de vistorias periódicas para verificação de consumo e reposição das iscas.',
                pragas: 'Ratazana (Rattus norvegicus), Rato preto (Rattus rattus), Camundongo (Mus musculus)'
            },
            'Descupinização': {
                metodos: 'Aplicação de barreira química líquida no solo e estruturas de madeira, com injeção de cupinicida em pontos estratégicos. Tratamento preventivo e corretivo com produtos específicos para eliminação de colônias.',
                pragas: 'Cupim de madeira seca (Cryptotermes sp.), Cupim subterrâneo (Coptotermes sp.), Cupim arborícola'
            }
        };

        const padrao = metodosPadrao[servico.tipo];
        if (padrao) {
            if (metodos.length === 0) {
                metodos = [padrao.metodos];
            }
            if (pragasAlvo.length === 0) {
                pragasAlvo = padrao.pragas.split(', ');
            }
        }

        return {
            descricao: metodos.join('; '),
            pragasAlvo: pragasAlvo,
            dataExecucao: servico.data
        };
    },

    /**
     * Gera observações específicas por tipo de serviço
     */
    _gerarObservacoesPorTipo: function(tipo, produtos) {
        const observacoes = {
            'Desinsetização': `Bifentol -- Interdição: Necessário por no mínimo 06 horas -- Ação Tóxica: Hipersensibilidade, Distúrbios Sensoriais, Cutâneos e Neurite Periférica -- Antídoto: Anti-histamínico e Sintomático.
Baramid -- Interdição: Não é necessário -- Ação Tóxica: Toxicante Metabólico, Inibidor da Respiração Celular -- Antidoto: Tratamento Sintomático.
Formifim -- Interdição: Não é necessário -- Ação Tóxica: Agonista da Acetilcolina, Hipersensibilidade, Distúrbios Sensoriais, Cutâneos e Neurite Periférica -- Antidoto: Anti-histamínico e Sintomático.`,

            'Desratização': `Raticida Blocos -- Interdição: Necessário por no mínimo 04 horas -- Ação Tóxica: Anticoagulante, Distúrbios de Coagulação -- Antídoto: Vitamina K1 e Tratamento Sintomático.
Raticida Pó -- Interdição: Não é necessário -- Ação Tóxica: Anticoagulante, Distúrbios de Coagulação -- Antídoto: Vitamina K1 e Tratamento Sintomático.`,

            'Descupinização': `Cupinicida Líquido -- Interdição: Necessário por no mínimo 08 horas -- Ação Tóxica: Neurotóxica, Distúrbios Sensoriais e Cutâneos -- Antídoto: Tratamento Sintomático.
Cupinicida Solvente -- Interdição: Necessário por no mínimo 08 horas -- Ação Tóxica: Neurotóxica, Distúrbios Sensoriais e Cutâneos -- Antídoto: Tratamento Sintomático.`
        };

        return observacoes[tipo] || '';
    },

    /**
     * Calcula a data de validade do certificado
     */
    _calcularDataValidade: function(dataServico, tipo) {
        const diasValidade = {
            'Desinsetização': 90,
            'Desratização': 90,
            'Descupinização': 365
        };

        const dias = diasValidade[tipo] || 90;
        const partes = dataServico.split('/');
        const data = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
        data.setDate(data.getDate() + dias);
        return data.toLocaleDateString('pt-BR');
    },

    /**
     * Renderiza o certificado em HTML para visualização
     */
    renderizarCertificado: function(certificado) {
        if (!certificado) return '<p>Certificado não encontrado</p>';

        const c = certificado;
        const produtosHtml = c.produtos.map(p => `
            <tr>
                <td style="padding:4px 8px;border:1px solid #ccc;text-align:center;font-size:9px;">${p.nome || '-'}</td>
                <td style="padding:4px 8px;border:1px solid #ccc;text-align:center;font-size:9px;">${p.registroMs || '-'}</td>
                <td style="padding:4px 8px;border:1px solid #ccc;text-align:center;font-size:9px;">${p.grupoQuimico || '-'}</td>
                <td style="padding:4px 8px;border:1px solid #ccc;text-align:center;font-size:9px;">${p.principioAtivo || '-'}</td>
                <td style="padding:4px 8px;border:1px solid #ccc;text-align:center;font-size:9px;">${p.concentracao || '-'}</td>
                <td style="padding:4px 8px;border:1px solid #ccc;text-align:center;font-size:9px;">${p.tratamento || 'Sintomático'}</td>
            </tr>
        `).join('');

        const clienteInfo = c.cliente;
        const clienteNome = clienteInfo.tipo === 'cnpj' ? 
            (clienteInfo.nome || clienteInfo.razaoSocial) : 
            clienteInfo.nome;

        return `
            <div style="font-family:Arial,sans-serif;font-size:10px;max-width:800px;margin:0 auto;padding:20px;background:white;border:1px solid #ddd;border-radius:8px;">
                <!-- Cabeçalho -->
                <div style="display:flex;align-items:center;gap:16px;border-bottom:2px solid #0b2a3b;padding-bottom:12px;margin-bottom:16px;">
                    <div style="flex-shrink:0;">
                        <svg viewBox="0 0 100 100" width="60" height="60" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="50" cy="50" r="45" fill="url(#certCircleGrad)" stroke="#1d7a6b" stroke-width="1.5"/>
                            <path d="M50 10 L82 22 L82 44 C82 63 66 77 50 83 C34 77 18 63 18 44 L18 22 L50 10Z" 
                                  fill="url(#certShieldGrad)" stroke="#7bc6a4" stroke-width="1"/>
                            <ellipse cx="50" cy="44" rx="10" ry="14" fill="#f5f5f5" stroke="#0b2a3b" stroke-width="1.2"/>
                            <circle cx="50" cy="33" r="7" fill="#f5f5f5" stroke="#0b2a3b" stroke-width="1.2"/>
                            <circle cx="47" cy="31" r="2.5" fill="#0b2a3b"/>
                            <circle cx="53" cy="31" r="2.5" fill="#0b2a3b"/>
                            <path d="M45 27 L38 19" stroke="#0b2a3b" stroke-width="1.2" stroke-linecap="round"/>
                            <path d="M55 27 L62 19" stroke="#0b2a3b" stroke-width="1.2" stroke-linecap="round"/>
                            <path d="M38 40 C26 33 22 46 30 52" stroke="#7bc6a4" stroke-width="1.5" stroke-linecap="round"/>
                            <path d="M62 40 C74 33 78 46 70 52" stroke="#7bc6a4" stroke-width="1.5" stroke-linecap="round"/>
                            <defs>
                                <linearGradient id="certCircleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="#f0f8f5"/>
                                    <stop offset="100%" stop-color="#e8eff5"/>
                                </linearGradient>
                                <linearGradient id="certShieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="#0b2a3b"/>
                                    <stop offset="100%" stop-color="#1d7a6b"/>
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <div style="flex:1;">
                        <div style="font-size:18px;font-weight:700;color:#0b2a3b;">${c.prestadora.nome}</div>
                        <div style="font-size:9px;color:#4d687a;">
                            CNPJ: ${c.prestadora.cnpj} | Alvará Sanitário: ${c.prestadora.alvaraSanitario} | Licença Ambiental: ${c.prestadora.licencaAmbiental}
                        </div>
                        <div style="font-size:9px;color:#4d687a;">${c.prestadora.endereco}</div>
                    </div>
                </div>

                <!-- Título -->
                <div style="text-align:center;font-size:16px;font-weight:700;color:#0b2a3b;margin:12px 0 8px;">
                    CERTIFICADO TÉCNICO
                </div>

                <!-- Conteúdo -->
                <div style="font-size:10px;line-height:1.5;">
                    <p style="margin:6px 0;">
                        Certificamos que foi prestado o serviço de <strong>${this._getTipoLabel(c.tipo)}</strong> em 
                        <strong>${c.dataServico}</strong>, à empresa: <strong>${clienteNome}</strong>
                        ${clienteInfo.razaoSocial ? `(${clienteInfo.razaoSocial})` : ''},
                        inscrita no ${clienteInfo.tipo === 'cnpj' ? 'CNPJ' : 'CPF'} n° ${clienteInfo.cnpjCpf},
                        situada à ${clienteInfo.endereco}, pela ${c.prestadora.nome}, utilizando produtos 
                        domissanitários em conformidade com a legislação em vigor.
                    </p>

                    <!-- Tabela de Produtos -->
                    <div style="margin:12px 0;">
                        <div style="font-weight:700;font-size:11px;margin-bottom:4px;">Produtos utilizados:</div>
                        <table style="width:100%;border-collapse:collapse;font-size:9px;">
                            <thead>
                                <tr style="background:#0b2a3b;color:white;">
                                    <th style="padding:4px 6px;border:1px solid #0b2a3b;text-align:center;">PRODUTO</th>
                                    <th style="padding:4px 6px;border:1px solid #0b2a3b;text-align:center;">REG. MS</th>
                                    <th style="padding:4px 6px;border:1px solid #0b2a3b;text-align:center;">GRUPO QUÍMICO</th>
                                    <th style="padding:4px 6px;border:1px solid #0b2a3b;text-align:center;">PRINCÍPIO ATIVO</th>
                                    <th style="padding:4px 6px;border:1px solid #0b2a3b;text-align:center;">CONCENTRAÇÃO</th>
                                    <th style="padding:4px 6px;border:1px solid #0b2a3b;text-align:center;">TRATAMENTO</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${produtosHtml || '<tr><td colspan="6" style="text-align:center;padding:8px;">Nenhum produto registrado</td></tr>'}
                            </tbody>
                        </table>
                    </div>

                    <!-- Observações -->
                    ${c.observacoes ? `
                        <div style="margin:10px 0;padding:8px 12px;background:#f8fbfd;border-left:3px solid #0b2a3b;border-radius:4px;">
                            <div style="font-weight:700;font-size:10px;">OBSERVAÇÕES:</div>
                            <div style="font-size:8px;white-space:pre-line;color:#1f3a4b;">${c.observacoes}</div>
                        </div>
                    ` : ''}

                    <!-- Métodos Empregados -->
                    <div style="margin:10px 0;">
                        <div style="font-weight:700;font-size:11px;">Métodos Empregados:</div>
                        <div style="font-size:9px;padding:4px 8px;background:#fafcfe;border-radius:4px;border:1px solid #e8eff5;">
                            ${c.metodos.descricao || 'Não informado'}
                            ${c.metodos.pragasAlvo && c.metodos.pragasAlvo.length > 0 ? 
                                `<br><strong>Pragas-Alvo:</strong> ${c.metodos.pragasAlvo.join(', ')}` : ''}
                            <br><strong>Data da Execução:</strong> ${c.dataServico} 
                            <strong>Data de Validade:</strong> ${c.dataValidade}
                        </div>
                    </div>

                    <!-- Responsáveis -->
                    <div style="margin:10px 0;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                        <div style="padding:6px 10px;background:#f8fbfd;border-radius:4px;text-align:center;">
                            <div style="font-weight:700;font-size:10px;">${c.responsaveis.tecnico.nome}</div>
                            <div style="font-size:8px;color:#4d687a;">${c.responsaveis.tecnico.registro}</div>
                            <div style="font-size:8px;color:#4d687a;">${c.responsaveis.tecnico.atuacao}</div>
                            <div style="font-size:7px;font-weight:600;margin-top:4px;">Resp. Técnico</div>
                        </div>
                        <div style="padding:6px 10px;background:#f8fbfd;border-radius:4px;text-align:center;">
                            <div style="font-weight:700;font-size:10px;">${c.responsaveis.operacional.nome}</div>
                            <div style="font-size:8px;color:#4d687a;">${c.responsaveis.operacional.registro}</div>
                            <div style="font-size:8px;color:#4d687a;">${c.responsaveis.operacional.atuacao}</div>
                            <div style="font-size:7px;font-weight:600;margin-top:4px;">Resp. Operacional</div>
                        </div>
                    </div>

                    <!-- Primeiros Socorros -->
                    <div style="margin:10px 0;padding:6px 10px;background:#fde8e6;border-radius:4px;border-left:3px solid #c0392b;">
                        <div style="font-weight:700;font-size:9px;color:#b13e3a;">Primeiros Socorros:</div>
                        <div style="font-size:8px;">Em caso de ingestão acidental, provoque o vômito e procure imediatamente o serviço de atendimento médico.</div>
                        <div style="font-size:8px;font-weight:600;color:#b13e3a;">Telefone de Emergência: ${c.telefoneEmergencia} (Centro de Informação Toxicológica)</div>
                        <div style="font-size:8px;color:#b13e3a;">Atenção: O ambiente passa por manutenção a cada 30 dias.</div>
                    </div>

                    <!-- Rodapé -->
                    <div style="margin-top:16px;padding-top:10px;border-top:1px solid #e8eff5;text-align:center;font-size:7px;color:#6a7f8d;">
                        Documento gerado em ${new Date(c.criadoEm).toLocaleString('pt-BR')} · Certificado Técnico
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Retorna o label do tipo de serviço
     */
    _getTipoLabel: function(tipo) {
        const map = {
            'Desinsetização': 'DESINSETIZAÇÃO',
            'Desratização': 'DESRATIZAÇÃO',
            'Descupinização': 'DESCUPINIZAÇÃO'
        };
        return map[tipo] || tipo.toUpperCase();
    },

    /**
     * Gera um PDF do certificado
     */
    gerarPDF: function(certificado) {
        const html = this.renderizarCertificado(certificado);
        
        // Cria uma janela para impressão
        const win = window.open('', '_blank', 'width=900,height=700');
        if (win) {
            win.document.write(`
                <html>
                <head>
                    <title>Certificado Técnico</title>
                    <style>
                        body { margin: 0; padding: 20px; background: #f0f4f8; }
                        @media print {
                            body { padding: 0; background: white; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    ${html}
                    <div style="text-align:center;margin-top:16px;" class="no-print">
                        <button onclick="window.print()" style="padding:10px 30px;background:#0b2a3b;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">
                            <i class="fas fa-print"></i> Imprimir / Salvar PDF
                        </button>
                        <button onclick="window.close()" style="padding:10px 30px;background:#e8eff5;color:#1f3a4b;border:none;border-radius:8px;cursor:pointer;font-weight:600;margin-left:10px;">
                            Fechar
                        </button>
                    </div>
                </body>
                </html>
            `);
            win.document.close();
        }
    },

    /**
     * Lista todos os certificados
     */
    listarCertificados: function(filtro) {
        let certificados = DB.getAll('certificados');
        
        if (filtro) {
            if (filtro.clienteId) {
                certificados = certificados.filter(c => String(c.clienteId) === String(filtro.clienteId));
            }
            if (filtro.tipo) {
                certificados = certificados.filter(c => c.tipo === filtro.tipo);
            }
            if (filtro.status) {
                certificados = certificados.filter(c => c.status === filtro.status);
            }
        }
        
        return certificados.sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
    },

    /**
     * Busca um certificado por ID
     */
    getCertificado: function(id) {
        return DB.getById('certificados', id);
    }
};

// =============================================
// ===== EXPORTAÇÃO =====
// =============================================

window.CertificadoService = CertificadoService;

console.log('✅ CertificadoService carregado com sucesso!');