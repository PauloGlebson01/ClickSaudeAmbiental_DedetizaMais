// =============================================
// CORREÇÃO DE AGENDA - COMPATÍVEL COM FIRESTORE
// =============================================

/**
 * CORREÇÃO: Função para garantir que o nome correto do cliente seja exibido na agenda
 * Versão compatível com Firestore
 */
async function corrigirNomesClientesAgenda() {
    try {
        const agendaKey = DB.getFullKey('agenda');
        let agendaItems = JSON.parse(localStorage.getItem(agendaKey) || '[]');
        let modificado = false;
        
        const clientes = DB.getAll('clientes');
        const clientesMap = {};
        clientes.forEach(function(c) {
            clientesMap[String(c.id)] = c;
        });
        
        for (let i = 0; i < agendaItems.length; i++) {
            const item = agendaItems[i];
            let itemModificado = false;
            
            if (item.clienteId) {
                const cliente = clientesMap[String(item.clienteId)];
                if (cliente) {
                    let nomeCorreto;
                    if (cliente.tipoCliente === 'cnpj') {
                        nomeCorreto = cliente.nomeFantasia || cliente.razaoSocial || cliente.nome || 'Cliente #' + cliente.id;
                    } else {
                        nomeCorreto = cliente.nome || 'Cliente #' + cliente.id;
                    }
                    
                    if (item.clienteNome && item.clienteNome !== nomeCorreto) {
                        item.clienteNome = nomeCorreto;
                        itemModificado = true;
                    }
                    
                    if (!item.clienteNome) {
                        item.clienteNome = nomeCorreto;
                        itemModificado = true;
                    }
                } else {
                    const clientePorNome = clientes.find(function(c) {
                        if (item.clienteNome) {
                            const nomeCliente = c.tipoCliente === 'cnpj' ? 
                                (c.nomeFantasia || c.razaoSocial || c.nome) : 
                                c.nome;
                            return nomeCliente && nomeCliente.toLowerCase().includes(item.clienteNome.toLowerCase());
                        }
                        return false;
                    });
                    
                    if (clientePorNome) {
                        item.clienteId = clientePorNome.id;
                        item.clienteNome = clientePorNome.tipoCliente === 'cnpj' ? 
                            (clientePorNome.nomeFantasia || clientePorNome.razaoSocial || clientePorNome.nome) : 
                            clientePorNome.nome;
                        itemModificado = true;
                        
                        const servico = DB.getById('servicos', item.servicoId);
                        if (servico) {
                            DB.update('servicos', servico.id, { clienteId: clientePorNome.id });
                            await sincronizarFirestore('servicos', servico.id, { clienteId: clientePorNome.id });
                        }
                    }
                }
            }
            
            if (item.servicoId) {
                const servico = DB.getById('servicos', item.servicoId);
                if (servico) {
                    const cliente = clientesMap[String(servico.clienteId)];
                    let nomeCliente = 'Cliente #' + servico.clienteId;
                    if (cliente) {
                        if (cliente.tipoCliente === 'cnpj') {
                            nomeCliente = cliente.nomeFantasia || cliente.razaoSocial || cliente.nome || nomeCliente;
                        } else {
                            nomeCliente = cliente.nome || nomeCliente;
                        }
                    }
                    
                    const descricaoCorreta = gerarDescricaoServico(servico, nomeCliente);
                    
                    if (item.descricao && item.descricao !== descricaoCorreta) {
                        item.descricao = descricaoCorreta;
                        itemModificado = true;
                    }
                    
                    if (item.statusServico !== servico.status) {
                        item.statusServico = servico.status;
                        itemModificado = true;
                    }
                    
                    if (item.data !== servico.data) {
                        item.data = servico.data;
                        itemModificado = true;
                    }
                    
                    if (item.horario !== (servico.horario || '09:00')) {
                        item.horario = servico.horario || '09:00';
                        itemModificado = true;
                    }
                }
            }
            
            if (itemModificado) {
                item.atualizadoEm = new Date().toISOString();
                modificado = true;
            }
        }
        
        if (modificado) {
            localStorage.setItem(agendaKey, JSON.stringify(agendaItems));
            DB.forceClearCache('agenda');
            
            for (const item of agendaItems) {
                if (item.id) {
                    await sincronizarFirestore('agenda', item.id, item);
                }
            }
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

/**
 * Função auxiliar para gerar descrição do serviço
 */
function gerarDescricaoServico(servico, nomeCliente) {
    const statusMap = {
        'Concluído': { emoji: '✅', label: 'Concluído' },
        'Concluida': { emoji: '✅', label: 'Concluído' },
        'Concluída': { emoji: '✅', label: 'Concluído' },
        'Em andamento': { emoji: '🔄', label: 'Em andamento' },
        'Pendente': { emoji: '⏳', label: 'Pendente' },
        'Agendado': { emoji: '📅', label: 'Agendado' },
        'Agendada': { emoji: '📅', label: 'Agendado' },
        'Cancelado': { emoji: '❌', label: 'Cancelado' },
        'Cancelada': { emoji: '❌', label: 'Cancelado' }
    };
    const statusInfo = statusMap[servico.status] || { emoji: '📌', label: servico.status };
    const valorFormatado = servico.valor ? servico.valor.toFixed(2).replace('.', ',') : '0,00';
    const tiposStr = servico.tipos && servico.tipos.length > 0 ? 
        servico.tipos.join(' + ') : 
        servico.tipo || 'Serviço';
    
    return `Serviço #${String(servico.id).padStart(3, '0')}: ${tiposStr} - ${statusInfo.emoji} ${statusInfo.label} (R$ ${valorFormatado})`;
}

/**
 * CORREÇÃO: Função para validar e corrigir clientes em serviços
 */
async function corrigirClientesServicos() {
    try {
        const servicos = DB.getAll('servicos');
        const clientes = DB.getAll('clientes');
        const clientesMap = {};
        clientes.forEach(function(c) {
            clientesMap[String(c.id)] = c;
        });
        
        let modificado = false;
        
        for (const servico of servicos) {
            if (servico.clienteId) {
                const cliente = clientesMap[String(servico.clienteId)];
                if (!cliente) {
                    const servicoNome = servico.clienteNome || '';
                    const clienteEncontrado = clientes.find(function(c) {
                        const nomeCliente = c.tipoCliente === 'cnpj' ? 
                            (c.nomeFantasia || c.razaoSocial || c.nome) : 
                            c.nome;
                        return nomeCliente && servicoNome.toLowerCase().includes(nomeCliente.toLowerCase());
                    });
                    
                    if (clienteEncontrado) {
                        DB.update('servicos', servico.id, { clienteId: clienteEncontrado.id });
                        await sincronizarFirestore('servicos', servico.id, { clienteId: clienteEncontrado.id });
                        modificado = true;
                    }
                }
            }
        }
        
        return modificado;
    } catch (e) {
        return false;
    }
}

/**
 * CORREÇÃO: Função para sincronizar agenda com serviços
 */
async function sincronizarAgendaComServicos() {
    try {
        const servicos = DB.getAll('servicos');
        const agendaKey = DB.getFullKey('agenda');
        let agendaItems = JSON.parse(localStorage.getItem(agendaKey) || '[]');
        
        const servicosMap = {};
        servicos.forEach(function(s) {
            servicosMap[String(s.id)] = s;
        });
        
        let modificado = false;
        const itensParaAdicionar = [];
        
        for (const servico of servicos) {
            const existeNaAgenda = agendaItems.some(function(a) {
                return a.servicoId === servico.id;
            });
            
            if (!existeNaAgenda && servico.status !== 'Cancelado' && servico.status !== 'Cancelada') {
                const cliente = getCliente(servico.clienteId);
                const clienteNome = cliente ? 
                    (cliente.tipoCliente === 'cnpj' ? 
                        (cliente.nomeFantasia || cliente.razaoSocial || cliente.nome) : 
                        cliente.nome) : 
                    'Cliente #' + servico.clienteId;
                
                const descricao = gerarDescricaoServico(servico, clienteNome);
                
                const maxId = agendaItems.reduce(function(max, a) {
                    var id = typeof a.id === 'number' ? a.id : parseInt(a.id) || 0;
                    return Math.max(max, id);
                }, 0);
                
                const novoItem = {
                    id: maxId + 1,
                    clienteId: servico.clienteId,
                    data: servico.data,
                    horario: servico.horario || '09:00',
                    descricao: descricao,
                    servicoId: servico.id,
                    statusServico: servico.status,
                    tiposServico: servico.tipos || [servico.tipo],
                    tipoServico: servico.tipo,
                    sincronizado: true,
                    clienteNome: clienteNome,
                    criadoEm: new Date().toISOString(),
                    atualizadoEm: new Date().toISOString()
                };
                
                agendaItems.push(novoItem);
                itensParaAdicionar.push(novoItem);
                modificado = true;
            }
        }
        
        const agendaFiltrada = agendaItems.filter(function(a) {
            if (a.servicoId) {
                const servicoExiste = servicosMap[String(a.servicoId)];
                if (!servicoExiste) {
                    modificado = true;
                    return false;
                }
                return true;
            }
            return true;
        });
        
        if (modificado) {
            localStorage.setItem(agendaKey, JSON.stringify(agendaFiltrada));
            DB.forceClearCache('agenda');
            
            for (const item of itensParaAdicionar) {
                await sincronizarFirestore('agenda', item.id, item);
            }
            
            for (const item of agendaFiltrada) {
                if (item.id && !itensParaAdicionar.some(a => a.id === item.id)) {
                    await sincronizarFirestore('agenda', item.id, item);
                }
            }
            
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

/**
 * CORREÇÃO: Sincroniza um item específico com o Firestore
 */
async function sincronizarFirestore(colecao, id, dados) {
    try {
        if (typeof FirestoreService === 'undefined') return;
        
        const empresaId = EmpresaManager.getEmpresaAtual();
        const docData = {
            ...dados,
            id: id,
            empresaId: empresaId,
            atualizadoEm: new Date().toISOString()
        };
        
        if (FirestoreService._isFirestoreAvailable()) {
            await db.collection(colecao).doc(String(id)).set(docData, { merge: true });
        }
    } catch (e) {}
}

/**
 * CORREÇÃO: Função para sincronizar dados locais com Firestore
 */
async function sincronizarColecaoComFirestore(colecao) {
    try {
        if (typeof FirestoreService === 'undefined') return;
        
        const items = DB.getAll(colecao);
        const empresaId = EmpresaManager.getEmpresaAtual();
        
        for (const item of items) {
            if (item.id) {
                const docData = {
                    ...item,
                    empresaId: empresaId,
                    atualizadoEm: new Date().toISOString()
                };
                
                if (FirestoreService._isFirestoreAvailable()) {
                    await db.collection(colecao).doc(String(item.id)).set(docData, { merge: true });
                }
            }
        }
    } catch (e) {}
}

/**
 * FUNÇÃO DE REPARO COMPLETO - Compatível com Firestore
 */
async function repararDadosAgenda() {
    await corrigirClientesServicos();
    await sincronizarAgendaComServicos();
    await corrigirNomesClientesAgenda();
    
    await sincronizarColecaoComFirestore('agenda');
    await sincronizarColecaoComFirestore('servicos');
    
    if (typeof renderAll === 'function') {
        renderAll();
    }
}

/**
 * CORREÇÃO: Sobrescreve a função de criação de serviço para garantir sincronização
 */
const criarNovoServicoOriginal = window.criarNovoServico;

window.criarNovoServico = function() {
    const clienteId = parseInt(document.getElementById('modalClienteId')?.value || '0');
    const tipo = document.getElementById('modalTipo')?.value || 'Desratização';
    const data = document.getElementById('modalData')?.value?.split('-').reverse().join('/') || '';
    const horario = document.getElementById('modalHorario')?.value || '09:00';
    const status = document.getElementById('modalStatus')?.value || 'Agendado';
    const valor = parseFloat(document.getElementById('modalValor')?.value) || 0;

    if (!clienteId || !data || !tipo) {
        alert('Preencha todos os campos obrigatórios!');
        return;
    }

    const servicosExistentes = DB.getAll('servicos');
    const servicoExistente = servicosExistentes.find(function(s) {
        return String(s.clienteId) === String(clienteId) &&
            s.data === data &&
            s.tipo === tipo &&
            (s.status === status || s.status === 'Agendado');
    });

    if (servicoExistente) {
        DB.update('servicos', servicoExistente.id, {
            status: status,
            valor: valor,
            horario: horario,
            atualizadoEm: new Date().toISOString()
        });

        sincronizarServicoComAgenda(servicoExistente, 'update');
        sincronizarServicoComOS(servicoExistente, 'update');

        if (typeof FirestoreService !== 'undefined') {
            setTimeout(function() {
                FirestoreService.sincronizarColecao('servicos');
                FirestoreService.sincronizarColecao('agenda');
            }, 100);
        }

        fecharModal();
        renderAll();
        alert('✅ Serviço #' + String(servicoExistente.id).padStart(3, '0') + ' atualizado para: ' + status);
        return;
    }

    const servico = DB.add('servicos', {
        clienteId: clienteId,
        tipo: tipo,
        data: data,
        status: status,
        valor: valor,
        horario: horario,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
    });

    const cliente = getCliente(clienteId);
    const clienteNome = cliente ? 
        (cliente.tipoCliente === 'cnpj' ? 
            (cliente.nomeFantasia || cliente.razaoSocial || cliente.nome) : 
            cliente.nome) : 
        'Cliente #' + clienteId;

    const statusMap = {
        'Concluído': { emoji: '✅', label: 'Concluído' },
        'Concluida': { emoji: '✅', label: 'Concluído' },
        'Concluída': { emoji: '✅', label: 'Concluído' },
        'Em andamento': { emoji: '🔄', label: 'Em andamento' },
        'Pendente': { emoji: '⏳', label: 'Pendente' },
        'Agendado': { emoji: '📅', label: 'Agendado' },
        'Agendada': { emoji: '📅', label: 'Agendado' },
        'Cancelado': { emoji: '❌', label: 'Cancelado' },
        'Cancelada': { emoji: '❌', label: 'Cancelado' }
    };
    const statusInfo = statusMap[status] || { emoji: '📌', label: status };
    const valorFormatado = valor ? valor.toFixed(2).replace('.', ',') : '0,00';
    const tiposStr = servico.tipos && servico.tipos.length > 0 ? 
        servico.tipos.join(' + ') : 
        tipo;
    const descricao = `Serviço #${String(servico.id).padStart(3, '0')}: ${tiposStr} - ${statusInfo.emoji} ${statusInfo.label} (R$ ${valorFormatado})`;

    const agendaKey = DB.getFullKey('agenda');
    const agendaItems = JSON.parse(localStorage.getItem(agendaKey) || '[]');
    
    const maxId = agendaItems.reduce(function(max, a) {
        var id = typeof a.id === 'number' ? a.id : parseInt(a.id) || 0;
        return Math.max(max, id);
    }, 0);
    
    const novoAgendamento = {
        id: maxId + 1,
        clienteId: clienteId,
        data: data,
        horario: horario,
        descricao: descricao,
        servicoId: servico.id,
        statusServico: status,
        tiposServico: servico.tipos || [tipo],
        tipoServico: tipo,
        sincronizado: true,
        clienteNome: clienteNome,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
    };

    agendaItems.push(novoAgendamento);
    localStorage.setItem(agendaKey, JSON.stringify(agendaItems));
    DB.forceClearCache('agenda');

    if (typeof FirestoreService !== 'undefined') {
        setTimeout(function() {
            FirestoreService.add('agenda', novoAgendamento);
            FirestoreService.sincronizarColecao('servicos');
        }, 100);
    }

    sincronizarServicoComOS(servico, 'add');

    if (status === 'Concluído' || status === 'Concluida' || status === 'Concluída') {
        verificarCertificadoAutomatico(servico);
    }

    DB.forceClearCache('agenda');
    DB._clearAllCaches();

    fecharModal();
    renderAll();

    setTimeout(function() {
        renderAll();
    }, 200);

    alert('✅ Serviço #' + String(servico.id).padStart(3, '0') + ' criado com status: ' + status);
};

/**
 * CORREÇÃO: Sobrescreve a função de edição de serviço para garantir sincronização
 */
const salvarEdicaoServicoOriginal = window.salvarEdicaoServico;

window.salvarEdicaoServico = function(id) {
    const clienteId = parseInt(document.getElementById('modalClienteId')?.value || '0');
    const tipo = document.getElementById('modalTipo')?.value || 'Desratização';
    const data = document.getElementById('modalData')?.value?.split('-').reverse().join('/') || '';
    const horario = document.getElementById('modalHorario')?.value || '09:00';
    const status = document.getElementById('modalStatus')?.value || 'Agendado';
    const valor = parseFloat(document.getElementById('modalValor')?.value) || 0;

    const servicoAntigo = DB.getById('servicos', id);
    if (!servicoAntigo) {
        alert('Serviço não encontrado!');
        return;
    }

    DB.update('servicos', id, {
        clienteId: clienteId,
        tipo: tipo,
        data: data,
        status: status,
        valor: valor,
        horario: horario,
        atualizadoEm: new Date().toISOString()
    });

    const servicoAtualizado = DB.getById('servicos', id);
    
    const cliente = getCliente(clienteId);
    const clienteNome = cliente ? 
        (cliente.tipoCliente === 'cnpj' ? 
            (cliente.nomeFantasia || cliente.razaoSocial || cliente.nome) : 
            cliente.nome) : 
        'Cliente #' + clienteId;

    const statusMap = {
        'Concluído': { emoji: '✅', label: 'Concluído' },
        'Concluida': { emoji: '✅', label: 'Concluído' },
        'Concluída': { emoji: '✅', label: 'Concluído' },
        'Em andamento': { emoji: '🔄', label: 'Em andamento' },
        'Pendente': { emoji: '⏳', label: 'Pendente' },
        'Agendado': { emoji: '📅', label: 'Agendado' },
        'Agendada': { emoji: '📅', label: 'Agendado' },
        'Cancelado': { emoji: '❌', label: 'Cancelado' },
        'Cancelada': { emoji: '❌', label: 'Cancelado' }
    };
    const statusInfo = statusMap[status] || { emoji: '📌', label: status };
    const valorFormatado = valor ? valor.toFixed(2).replace('.', ',') : '0,00';
    const tiposStr = servicoAtualizado.tipos && servicoAtualizado.tipos.length > 0 ? 
        servicoAtualizado.tipos.join(' + ') : 
        tipo;
    const descricao = `Serviço #${String(id).padStart(3, '0')}: ${tiposStr} - ${statusInfo.emoji} ${statusInfo.label} (R$ ${valorFormatado})`;

    const agendaKey = DB.getFullKey('agenda');
    let agendaItems = JSON.parse(localStorage.getItem(agendaKey) || '[]');
    const agendamentoExistente = agendaItems.find(function(a) {
        return a.servicoId === id;
    });

    if (agendamentoExistente) {
        const index = agendaItems.findIndex(function(a) { return a.id === agendamentoExistente.id; });
        if (index !== -1) {
            agendaItems[index] = {
                ...agendamentoExistente,
                clienteId: clienteId,
                data: data,
                horario: horario,
                descricao: descricao,
                statusServico: status,
                tipoServico: tipo,
                clienteNome: clienteNome,
                atualizadoEm: new Date().toISOString()
            };
            localStorage.setItem(agendaKey, JSON.stringify(agendaItems));
            
            if (typeof FirestoreService !== 'undefined') {
                setTimeout(function() {
                    FirestoreService.update('agenda', agendamentoExistente.id, agendaItems[index]);
                }, 100);
            }
        }
    } else {
        sincronizarServicoComAgenda(servicoAtualizado, 'add', servicoAntigo);
    }

    sincronizarServicoComOS(servicoAtualizado, 'update');

    if (status === 'Concluído' || status === 'Concluida' || status === 'Concluída') {
        verificarCertificadoAutomatico(servicoAtualizado);
    }

    if (typeof FirestoreService !== 'undefined') {
        setTimeout(function() {
            FirestoreService.sincronizarColecao('servicos');
            FirestoreService.sincronizarColecao('agenda');
        }, 100);
    }

    DB.forceClearCache('agenda');
    DB._clearAllCaches();

    fecharModal();
    renderAll();

    setTimeout(function() {
        renderAll();
    }, 300);

    alert('✅ Serviço #' + String(id).padStart(3, '0') + ' atualizado para: ' + status);
};

/**
 * CORREÇÃO: Sobrescreve a função de edição de cliente para atualizar agenda automaticamente
 */
const salvarEdicaoClienteOriginal = window.salvarEdicaoCliente;

window.salvarEdicaoCliente = function(id) {
    const tipoCliente = document.getElementById('modalTipoCliente')?.value || 'cpf';
    const nome = document.getElementById('modalNome')?.value || '';
    const documento = document.getElementById('modalDocumento')?.value || '';
    const telefone = document.getElementById('modalTelefone')?.value || '';
    const endereco = document.getElementById('modalEndereco')?.value || '';

    let razaoSocial = '';
    let nomeFantasia = '';

    if (tipoCliente === 'cnpj') {
        razaoSocial = document.getElementById('modalRazaoSocial')?.value || '';
        nomeFantasia = document.getElementById('modalNomeFantasia')?.value || '';

        if (!razaoSocial) {
            alert('Razão Social é obrigatória para Pessoa Jurídica!');
            return;
        }
        if (!nome) {
            alert('Nome Fantasia é obrigatório para Pessoa Jurídica!');
            return;
        }
    }

    if (!nome) {
        alert(tipoCliente === 'cnpj' ? 'Nome Fantasia é obrigatório' : 'Nome é obrigatório');
        return;
    }
    if (!documento) {
        alert(tipoCliente === 'cnpj' ? 'CNPJ é obrigatório' : 'CPF é obrigatório');
        return;
    }

    const updateData = {
        nome: nome,
        tipoCliente: tipoCliente,
        documento: documento,
        telefone: telefone,
        endereco: endereco
    };

    if (tipoCliente === 'cnpj') {
        updateData.razaoSocial = razaoSocial;
        updateData.nomeFantasia = nomeFantasia;
    } else {
        updateData.razaoSocial = null;
        updateData.nomeFantasia = null;
    }

    const clienteAntigo = DB.getById('clientes', id);
    DB.update('clientes', id, updateData);
    DB.forceClearCache('clientes');

    // Atualiza a agenda com o novo nome do cliente
    setTimeout(function() {
        const agendaKey = DB.getFullKey('agenda');
        let agendaItems = JSON.parse(localStorage.getItem(agendaKey) || '[]');
        let modificado = false;

        const nomeCorreto = tipoCliente === 'cnpj' ? 
            (nomeFantasia || razaoSocial || nome) : 
            nome;

        agendaItems = agendaItems.map(function(item) {
            if (String(item.clienteId) === String(id)) {
                if (item.clienteNome !== nomeCorreto) {
                    item.clienteNome = nomeCorreto;
                    item.atualizadoEm = new Date().toISOString();
                    modificado = true;
                }
                
                if (item.servicoId) {
                    const servico = DB.getById('servicos', item.servicoId);
                    if (servico) {
                        const novaDescricao = gerarDescricaoServico(servico, nomeCorreto);
                        if (item.descricao !== novaDescricao) {
                            item.descricao = novaDescricao;
                            modificado = true;
                        }
                    }
                }
            }
            return item;
        });

        if (modificado) {
            localStorage.setItem(agendaKey, JSON.stringify(agendaItems));
            DB.forceClearCache('agenda');
            
            if (typeof FirestoreService !== 'undefined') {
                setTimeout(function() {
                    for (const item of agendaItems) {
                        if (String(item.clienteId) === String(id) && item.id) {
                            FirestoreService.update('agenda', item.id, item);
                        }
                    }
                    FirestoreService.sincronizarColecao('agenda');
                }, 100);
            }
        }

        // Atualiza também os serviços
        const servicos = DB.getAll('servicos');
        let servicosModificados = false;
        
        servicos.forEach(function(servico) {
            if (String(servico.clienteId) === String(id)) {
                const servicoNome = tipoCliente === 'cnpj' ? 
                    (nomeFantasia || razaoSocial || nome) : 
                    nome;
                if (servico.clienteNome !== servicoNome) {
                    DB.update('servicos', servico.id, { clienteNome: servicoNome });
                    servicosModificados = true;
                }
            }
        });

        if (servicosModificados && typeof FirestoreService !== 'undefined') {
            setTimeout(function() {
                FirestoreService.sincronizarColecao('servicos');
            }, 100);
        }

        if (modificado || servicosModificados) {
            renderAll();
        }
    }, 100);

    fecharModal();
    renderAll();
    alert('Cliente atualizado com sucesso!');
};

/**
 * CORREÇÃO: Sobrescreve a função de edição de serviço para atualizar agenda com nome correto
 */
const editarServicoOriginal = window.editarServico;

window.editarServico = function(id) {
    const s = DB.getById('servicos', id);
    if (!s) return;

    const validade = calcularValidadeServico(s);
    let infoValidade = '';
    if (validade) {
        const statusMap = {
            'valido': '🟢 Válido',
            'proximo': '🟡 Próximo do vencimento',
            'critico': '🔴 Vence em breve',
            'vencido': '❌ Vencido'
        };
        infoValidade = `
            <div style="background:#f8fbfd;padding:12px 16px;border-radius:8px;margin-bottom:16px;">
                <strong>Validade:</strong> ${statusMap[validade.status] || 'Válido'} 
                (${validade.diasRestantes > 0 ? validade.diasRestantes + ' dias restantes' : Math.abs(validade.diasRestantes) + ' dias vencido'})
                <br><small style="color:#4d687a;">Vence em: ${validade.dataVencimento.toLocaleDateString('pt-BR')}</small>
            </div>
        `;
    }

    const clientes = DB.getAll('clientes');
    
    abrirModal('Editar Serviço', `
        ${infoValidade}
        <div class="form-group">
            <label>Cliente</label>
            <select id="modalClienteId" onchange="atualizarNomeClienteServico(this.value)">
                ${clientes.map(function(c) {
                    const nomeExibido = c.tipoCliente === 'cnpj' ? 
                        (c.nomeFantasia || c.razaoSocial || c.nome) : 
                        c.nome;
                    return `<option value="${c.id}" ${c.id === s.clienteId ? 'selected' : ''}>${nomeExibido}</option>`;
                }).join('')}
            </select>
        </div>
        <div id="clienteNomeDisplay" style="background:#f0f7fc;padding:8px 14px;border-radius:8px;margin-bottom:12px;font-size:0.9rem;color:#4d687a;">
            <i class="fas fa-user"></i> Cliente selecionado: <strong id="clienteNomeSelecionado">${getClienteNome(s.clienteId)}</strong>
        </div>
        <div class="form-group">
            <label>Tipo de Serviço</label>
            <select id="modalTipo">
                ${['Desratização', 'Desinsetização', 'Descupinização'].map(function(t) {
                    return `<option value="${t}" ${t === s.tipo ? 'selected' : ''}>${t}</option>`;
                }).join('')}
            </select>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Data</label><input type="date" id="modalData" value="${s.data.split('/').reverse().join('-')}" /></div>
            <div class="form-group"><label>Horário</label><input type="time" id="modalHorario" value="${s.horario || '09:00'}" /></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Valor (R$)</label><input type="number" id="modalValor" value="${s.valor || 0}" step="0.01" /></div>
            <div class="form-group"><label>Status</label>
                <select id="modalStatus">
                    ${['Concluído', 'Em andamento', 'Pendente', 'Agendado', 'Cancelado'].map(function(st) {
                        return `<option value="${st}" ${st === s.status ? 'selected' : ''}>${st}</option>`;
                    }).join('')}
                </select>
            </div>
        </div>
        <small style="color:#4d687a;font-size:0.8rem;display:block;margin-top:4px;">⚠️ Alterar o cliente ou status atualizará automaticamente a agenda.</small>
        <div class="modal-footer">
            <button class="btn-secondary" onclick="fecharModal()">Cancelar</button>
            <button class="btn-primary" onclick="salvarEdicaoServico(${id})">Salvar</button>
        </div>
    `);
    
    setTimeout(function() {
        const selectCliente = document.getElementById('modalClienteId');
        if (selectCliente) {
            selectCliente.addEventListener('change', function() {
                const clienteId = parseInt(this.value);
                const cliente = getCliente(clienteId);
                const nomeCliente = cliente ? 
                    (cliente.tipoCliente === 'cnpj' ? 
                        (cliente.nomeFantasia || cliente.razaoSocial || cliente.nome) : 
                        cliente.nome) : 
                    'Cliente não encontrado';
                const display = document.getElementById('clienteNomeSelecionado');
                if (display) display.textContent = nomeCliente;
            });
        }
    }, 100);
};

/**
 * CORREÇÃO: Função para atualizar nome do cliente no serviço
 */
window.atualizarNomeClienteServico = function(clienteId) {
    const cliente = getCliente(parseInt(clienteId));
    const nomeCliente = cliente ? 
        (cliente.tipoCliente === 'cnpj' ? 
            (cliente.nomeFantasia || cliente.razaoSocial || cliente.nome) : 
            cliente.nome) : 
        'Cliente não encontrado';
    const display = document.getElementById('clienteNomeSelecionado');
    if (display) display.textContent = nomeCliente;
};

// Executa automaticamente o reparo ao carregar a página
setTimeout(function() {
    try {
        if (typeof FirestoreService !== 'undefined') {
            FirestoreService.sincronizarColecao('agenda').then(function() {
                repararDadosAgenda();
            }).catch(function() {
                repararDadosAgenda();
            });
        } else {
            repararDadosAgenda();
        }
    } catch (e) {}
}, 2000);