// =============================================
// ===== PREVENÇÃO DE ERROS DE REFERÊNCIA =====
// =============================================
(function () {
    'use strict';

    const noop = function () { return; };

    if (typeof Proxy !== 'undefined') {
        const handler = {
            get: function (target, prop) {
                if (typeof prop === 'string' && prop.startsWith('doc_')) {
                    if (!(prop in target)) {
                        target[prop] = noop;
                        return noop;
                    }
                }
                return target[prop];
            }
        };

        Object.defineProperty(window, 'doc_', {
            get: function () { return noop; },
            set: function (val) { },
            configurable: true
        });

        document.addEventListener('click', function (e) {
            const target = e.target;
            if (target && target.hasAttribute && target.hasAttribute('onclick')) {
                const onclickAttr = target.getAttribute('onclick');
                if (onclickAttr && onclickAttr.includes('doc_')) {
                    const funcName = onclickAttr.match(/doc_[a-zA-Z0-9_]+/);
                    if (funcName && typeof window[funcName[0]] === 'undefined') {
                        window[funcName[0]] = noop;
                    }
                }
            }
        }, true);
    } else {
        Object.defineProperty(window, 'doc_', {
            get: function () { return function () { return; }; },
            set: function (val) { },
            configurable: true
        });
    }

    window.doc_1785069999841_prdb = function () { return; };
    window.doc_1785032048813_otto = function () { return; };
    window.doc_1785075141708_f5ks = function () { return; };
    window.doc_1785075132377_vs6h = function () { return; };

})();

(function () {
    'use strict';

    // ===== FORÇAR LIMPEZA DE CACHE AO TROCAR DE SESSÃO =====
    function resetarSessaoAtual() {
        const session = localStorage.getItem('dedetiza_session');
        if (session) {
            try {
                const data = JSON.parse(session);
                const empresaAtual = EmpresaManager.getEmpresaAtual();

                if (data.empresa && data.empresa !== empresaAtual) {
                    if (typeof FirestoreService !== 'undefined') {
                        FirestoreService.pararObservadores();
                    }
                    const collections = ['clientes', 'servicos', 'ordens', 'agenda', 'equipe',
                        'pontosIscas', 'relatorios', 'modelos', 'estoque',
                        'movimentacoes', 'orcamentos', 'configuracoes', 'certificados'];
                    const prefixoAntigo = 'dedetiza_' + data.empresa + '_';
                    collections.forEach(col => {
                        localStorage.removeItem(prefixoAntigo + col);
                    });
                    if (typeof DB !== 'undefined') {
                        DB._clearAllCaches();
                    }
                }
            } catch (e) {
                console.warn('Erro ao resetar sessão:', e);
            }
        }
    }

    // ===== VERIFICA SE O USUÁRIO ESTÁ LOGADO =====
    function verificarAutenticacao() {
        if (window._authVerifying) {
            return false;
        }
        window._authVerifying = true;

        try {
            const session = localStorage.getItem('dedetiza_session');

            if (typeof EmpresaManager !== 'undefined') {
                const sessoes = EmpresaManager._carregarSessoes();
                const empresaAtual = EmpresaManager.getEmpresaAtual();

                if (sessoes[empresaAtual] && sessoes[empresaAtual].uid) {
                    window._authVerifying = false;
                    return true;
                }

                const keys = Object.keys(sessoes);
                if (keys.length > 0) {
                    if (!AuthGuard.isRedirecting() && AuthGuard.startRedirect()) {
                        const url = new URL('index.html', window.location.origin);
                        url.searchParams.set('empresa', keys[0]);
                        window.location.href = url.toString();
                    }
                    window._authVerifying = false;
                    return false;
                }
            }

            if (session) {
                try {
                    const data = JSON.parse(session);
                    if (data && data.uid) {
                        if (typeof EmpresaManager !== 'undefined') {
                            const empresaId = data.empresa || 'default';
                            EmpresaManager.salvarSessao(empresaId, data);

                            if (!AuthGuard.isRedirecting() && AuthGuard.startRedirect()) {
                                const url = new URL('index.html', window.location.origin);
                                url.searchParams.set('empresa', empresaId);
                                window.location.href = url.toString();
                            }
                        }
                        window._authVerifying = false;
                        return true;
                    }
                } catch (e) {
                    localStorage.removeItem('dedetiza_session');
                }
            }

            if (!AuthGuard.isRedirecting() && AuthGuard.startRedirect()) {
                window.location.href = 'login.html';
            }
            window._authVerifying = false;
            return false;
        } catch (e) {
            console.error('Erro na verificação de autenticação:', e);
            window._authVerifying = false;
            if (!AuthGuard.isRedirecting() && AuthGuard.startRedirect()) {
                window.location.href = 'login.html';
            }
            return false;
        }
    }

    // ===== VERIFICA EMPRESA NA URL =====
    function verificarEmpresa() {
        const urlParams = new URLSearchParams(window.location.search);
        const empresa = urlParams.get('empresa') || urlParams.get('e');

        if (empresa && typeof EmpresaManager !== 'undefined') {
            EmpresaManager.setEmpresaAtual(empresa);

            const session = localStorage.getItem('dedetiza_session');
            if (session) {
                try {
                    const data = JSON.parse(session);
                    if (data.empresa !== empresa) {
                        data.empresa = empresa;
                        localStorage.setItem('dedetiza_session', JSON.stringify(data));
                    }
                } catch (e) {
                    console.warn('Erro ao verificar sessão:', e);
                }
            }

            const empresaInfo = EmpresaManager.getEmpresa(empresa);
            if (!empresaInfo) {
                console.warn('⚠️ Empresa não encontrada:', empresa);
                const session = localStorage.getItem('dedetiza_session');
                if (session) {
                    try {
                        const data = JSON.parse(session);
                        const novaEmpresa = EmpresaManager.criarEmpresa(
                            data.nome + ' - Empresa',
                            empresa
                        );
                        EmpresaManager.adicionarAdmin(novaEmpresa.id, data.uid, data.email, data.nome);
                    } catch (e) {
                        console.warn('Erro ao criar empresa:', e);
                    }
                }
            }
            return true;
        }

        const session = localStorage.getItem('dedetiza_session');
        if (session) {
            try {
                const data = JSON.parse(session);
                if (data.empresa) {
                    if (typeof EmpresaManager !== 'undefined') {
                        EmpresaManager.setEmpresaAtual(data.empresa);
                    }
                    const url = new URL(window.location.href);
                    if (!url.searchParams.has('empresa') && !url.searchParams.has('e')) {
                        url.searchParams.set('empresa', data.empresa);
                        window.history.replaceState({}, '', url.toString());
                    }
                    return true;
                }
            } catch (e) {
                console.warn('Erro ao ler sessão:', e);
            }
        }

        if (typeof EmpresaManager !== 'undefined') {
            try {
                const novaEmpresa = EmpresaManager.criarEmpresa('Minha Empresa');
                const session = localStorage.getItem('dedetiza_session');
                if (session) {
                    const data = JSON.parse(session);
                    EmpresaManager.adicionarAdmin(novaEmpresa.id, data.uid, data.email, data.nome);
                    data.empresa = novaEmpresa.id;
                    localStorage.setItem('dedetiza_session', JSON.stringify(data));
                    EmpresaManager.setEmpresaAtual(novaEmpresa.id);

                    const url = new URL(window.location.href);
                    url.searchParams.set('empresa', novaEmpresa.id);
                    window.history.replaceState({}, '', url.toString());
                    return true;
                }
            } catch (e) {
                console.warn('Erro ao criar empresa:', e);
            }
        }

        return true;
    }

    verificarEmpresa();

    // ===== CARREGA DADOS DO USUÁRIO =====
    async function carregarDadosUsuario() {
        try {
            let nomeExibido = 'Admin';

            if (firebase && firebase.auth) {
                try {
                    const user = firebase.auth().currentUser;
                    if (user) {
                        if (user.displayName) {
                            nomeExibido = user.displayName;
                        } else if (user.email) {
                            nomeExibido = user.email.split('@')[0];
                        }
                    }
                } catch (e) {
                    console.warn('Erro ao buscar usuário do Firebase:', e);
                }
            }

            if (nomeExibido === 'Admin' || nomeExibido.includes('@')) {
                try {
                    if (typeof AuthService !== 'undefined') {
                        const userData = await AuthService.getCurrentUserData();
                        if (userData) {
                            nomeExibido = userData.usuario || userData.nome || userData.email || 'Admin';
                            if (nomeExibido && nomeExibido.includes('@')) {
                                nomeExibido = nomeExibido.split('@')[0];
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Erro ao buscar dados do AuthService:', e);
                }
            }

            if (nomeExibido === 'Admin' || nomeExibido.includes('@')) {
                try {
                    const session = localStorage.getItem('dedetiza_session');
                    if (session) {
                        const data = JSON.parse(session);
                        nomeExibido = data.usuario || data.nome || data.email || 'Admin';
                        if (nomeExibido && nomeExibido.includes('@')) {
                            nomeExibido = nomeExibido.split('@')[0];
                        }
                    }
                } catch (e) {
                    console.warn('Erro ao ler session:', e);
                }
            }

            if (nomeExibido === 'Admin' || nomeExibido.includes('@')) {
                try {
                    const atual = localStorage.getItem('dedetiza_session_atual');
                    if (atual) {
                        const data = JSON.parse(atual);
                        nomeExibido = data.usuario || data.nome || data.email || 'Admin';
                        if (nomeExibido && nomeExibido.includes('@')) {
                            nomeExibido = nomeExibido.split('@')[0];
                        }
                    }
                } catch (e) {
                    console.warn('Erro ao ler session atual:', e);
                }
            }

            if (nomeExibido === 'Admin' || nomeExibido.includes('@')) {
                try {
                    const users = JSON.parse(localStorage.getItem('dedetiza_users') || '[]');
                    if (users.length > 0) {
                        const user = users[0];
                        nomeExibido = user.usuario || user.nome || user.email || 'Admin';
                        if (nomeExibido && nomeExibido.includes('@')) {
                            nomeExibido = nomeExibido.split('@')[0];
                        }
                    }
                } catch (e) {
                    console.warn('Erro ao buscar users:', e);
                }
            }

            const nomeEl = document.getElementById('userName');
            if (nomeEl) {
                nomeEl.textContent = nomeExibido;
            }

            const empresaEl = document.querySelector('.topbar-empresa');
            if (empresaEl && typeof EmpresaManager !== 'undefined') {
                const empresaId = EmpresaManager.getEmpresaAtual();
                const empresaInfo = EmpresaManager.getEmpresa(empresaId);
                if (empresaInfo) {
                    empresaEl.textContent = '🏢 ' + empresaInfo.nome;
                }
            }
        } catch (error) {
            console.warn('Erro ao carregar dados do usuário:', error);
        }
    }

    // ===== CONFIGURAÇÕES PADRÃO =====
    const CONFIG_PADRAO = {
        empresa: {
            nome: '',
            cnpj: '',
            telefone: '',
            endereco: '',
            email: '',
            logo: null
        },
        relatorio: {
            titulo: 'Relatório Técnico',
            subtitulo: 'Controle de Pragas',
            cor: '#0b2a3b',
            rodape: 'Este relatório é de propriedade da empresa e contém informações confidenciais.'
        }
    };

    // ===== DADOS INICIAIS VAZIOS =====
    const DADOS_PADRAO = {
        clientes: [],
        servicos: [],
        agenda: [],
        equipe: [],
        ordens: [],
        orcamentos: [],
        pontosIscas: [],
        certificados: [],
        modelos: [
            {
                id: 1,
                nome: 'Modelo Padrão - Desratização',
                categoria: 'desratizacao',
                campos: [
                    { label: 'Data da Inspeção', tipo: 'texto', valor: '' },
                    { label: 'Local da Inspeção', tipo: 'texto', valor: '' },
                    { label: 'Pontos de Monitoramento', tipo: 'texto', valor: '' },
                    { label: 'Atividade Identificada', tipo: 'texto', valor: '' },
                    { label: 'Ações Realizadas', tipo: 'texto', valor: '' }
                ],
                cor: '#e67e22'
            },
            {
                id: 2,
                nome: 'Modelo Avançado - Desinsetização',
                categoria: 'desinsetizacao',
                campos: [
                    { label: 'Data da Aplicação', tipo: 'texto', valor: '' },
                    { label: 'Área Tratada', tipo: 'texto', valor: '' },
                    { label: 'Produto Utilizado', tipo: 'texto', valor: '' },
                    { label: 'Concentração', tipo: 'texto', valor: '' },
                    { label: 'Prazo de Reentrada', tipo: 'texto', valor: '' },
                    { label: 'Eficácia Observada', tipo: 'texto', valor: '' }
                ],
                cor: '#1d7a6b'
            },
            {
                id: 3,
                nome: 'Modelo Técnico - Descupinização',
                categoria: 'descupinizacao',
                campos: [
                    { label: 'Data da Vistoria', tipo: 'texto', valor: '' },
                    { label: 'Estrutura Inspecionada', tipo: 'texto', valor: '' },
                    { label: 'Nível de Infestação', tipo: 'texto', valor: '' },
                    { label: 'Tratamento Aplicado', tipo: 'texto', valor: '' },
                    { label: 'Garantia', tipo: 'texto', valor: '' }
                ],
                cor: '#8e44ad'
            },
            {
                id: 4,
                nome: 'Modelo - Não Conformidade',
                categoria: 'nao-conformidade',
                campos: [
                    { label: 'Data da Ocorrência', tipo: 'texto', valor: '' },
                    { label: 'Local da Não Conformidade', tipo: 'texto', valor: '' },
                    { label: 'Descrição do Problema', tipo: 'texto', valor: '' },
                    { label: 'Causa Raiz', tipo: 'texto', valor: '' },
                    { label: 'Ação Corretiva', tipo: 'texto', valor: '' },
                    { label: 'Prazo para Correção', tipo: 'texto', valor: '' }
                ],
                cor: '#c0392b'
            }
        ],
        relatorios: [],
        estoque: [],
        movimentacoes: []
    };

    // =============================================
    // ===== GERENCIADOR DE DADOS CORRIGIDO =====
    // =============================================
    const DB = {
        _cache: {},
        _cacheTime: {},
        CACHE_TTL: 100,
        _lastFirestoreSync: {},
        _syncInProgress: false,
        _isSaving: false,

        _getPrefix: function () {
            try {
                if (typeof EmpresaManager !== 'undefined') {
                    const empresa = EmpresaManager.getEmpresaAtual();
                    return 'dedetiza_' + empresa + '_';
                }
            } catch (e) { }
            return 'dedetiza_';
        },

        _getCacheKey: function (collection, id) {
            return id ? collection + '_' + id : collection;
        },

        _isCacheValid: function (key) {
            var time = this._cacheTime[key];
            if (!time) return false;
            return (Date.now() - time) < this.CACHE_TTL;
        },

        _getFromCache: function (key) {
            if (this._isCacheValid(key)) {
                return this._cache[key];
            }
            return null;
        },

        _setCache: function (key, data) {
            this._cache[key] = data;
            this._cacheTime[key] = Date.now();
        },

        _clearCache: function (collection) {
            var self = this;
            Object.keys(this._cache).forEach(function (key) {
                if (key.indexOf(collection) === 0) {
                    delete self._cache[key];
                    delete self._cacheTime[key];
                }
            });
            if (this._cache[collection]) {
                delete this._cache[collection];
                delete this._cacheTime[collection];
            }
        },

        _clearAllCaches: function () {
            this._cache = {};
            this._cacheTime = {};
        },

        forceClearCache: function (collection) {
            this._clearCache(collection);
        },

        getFullKey: function (collection) {
            return this._getPrefix() + collection;
        },

        getAll: function (collection, forceRefresh = false) {
            try {
                var key = this.getFullKey(collection);

                if (forceRefresh) {
                    this._clearCache(collection);
                }

                var cached = this._getFromCache(key);
                if (cached !== null && !forceRefresh) {
                    return cached;
                }

                var data = JSON.parse(localStorage.getItem(key) || '[]');
                var uniqueData = this._removeDuplicates(data);
                if (uniqueData.length !== data.length) {
                    localStorage.setItem(key, JSON.stringify(uniqueData));
                }
                this._setCache(key, uniqueData);
                return uniqueData;
            } catch (error) {
                console.warn('Erro ao buscar ' + collection + ' do localStorage:', error);
                return [];
            }
        },

        _removeDuplicates: function (items) {
            var seen = {};
            return items.filter(function (item) {
                var id = String(item.id || '');
                if (!id) return true;
                if (seen[id]) {
                    console.warn('⚠️ Duplicata removida:', id);
                    return false;
                }
                seen[id] = true;
                return true;
            });
        },

        getById: function (collection, id) {
            var items = this.getAll(collection);
            var idStr = String(id);
            return items.find(function (item) { return String(item.id) === idStr; }) || null;
        },

        add: function (collection, item) {
            if (this._isSaving) {
                console.warn('⚠️ Salvamento em andamento, ignorando duplicata:', collection);
                return item;
            }

            this._isSaving = true;

            try {
                var items = this.getAll(collection);

                if (item.id) {
                    var existing = items.find(function (i) { return String(i.id) === String(item.id); });
                    if (existing) {
                        console.warn('⚠️ Item já existe, atualizando em vez de adicionar:', item.id);
                        this._isSaving = false;
                        return this.update(collection, item.id, item);
                    }
                }

                var maxId = items.reduce(function (max, i) {
                    var id = typeof i.id === 'number' ? i.id : parseInt(i.id) || 0;
                    return Math.max(max, id);
                }, 0);
                var newItem = Object.assign({}, item, { id: maxId + 1 });

                var updatedItems = items.concat([newItem]);
                var key = this.getFullKey(collection);
                localStorage.setItem(key, JSON.stringify(updatedItems));
                this._clearCache(collection);

                if (typeof FirestoreService !== 'undefined' && !window._firestoreSyncing) {
                    try {
                        FirestoreService.add(collection, newItem).catch(function (error) {
                            console.warn('⚠️ Erro na sincronização de ' + collection + ':', error);
                        });
                    } catch (error) {
                        console.warn('⚠️ Erro na sincronização de ' + collection + ':', error);
                    }
                }

                this._isSaving = false;

                if (collection === 'estoque') {
                    var event = new CustomEvent('estoqueAtualizado', {
                        detail: { item: newItem, action: 'add' }
                    });
                    document.dispatchEvent(event);
                }

                if (collection === 'movimentacoes') {
                    var movEvent = new CustomEvent('movimentacaoAtualizada', {
                        detail: { item: newItem, action: 'add' }
                    });
                    document.dispatchEvent(movEvent);
                }

                if (collection === 'certificados') {
                    var certEvent = new CustomEvent('certificadoAtualizado', {
                        detail: { item: newItem, action: 'add' }
                    });
                    document.dispatchEvent(certEvent);
                }

                if (collection === 'pontosIscas') {
                    var mapaEvent = new CustomEvent('pontoIscaAtualizado', {
                        detail: { item: newItem, action: 'add' }
                    });
                    document.dispatchEvent(mapaEvent);
                }

                return newItem;
            } catch (e) {
                this._isSaving = false;
                throw e;
            }
        },

        update: function (collection, id, updates) {
            if (this._isSaving) {
                console.warn('⚠️ Salvamento em andamento, ignorando atualização duplicada:', collection);
                return null;
            }

            this._isSaving = true;

            try {
                var key = this.getFullKey(collection);
                var items = JSON.parse(localStorage.getItem(key) || '[]');
                var idStr = String(id);
                var index = items.findIndex(function (i) { return String(i.id) === idStr; });
                if (index !== -1) {
                    items[index] = Object.assign({}, items[index], updates);
                    localStorage.setItem(key, JSON.stringify(items));
                    this._clearCache(collection);

                    if (typeof FirestoreService !== 'undefined' && !window._firestoreSyncing) {
                        try {
                            FirestoreService.update(collection, id, items[index]).catch(function (error) {
                                console.warn('⚠️ Erro na sincronização de ' + collection + ':', error);
                            });
                        } catch (error) {
                            console.warn('⚠️ Erro na sincronização de ' + collection + ':', error);
                        }
                    }

                    if (collection === 'pontosIscas') {
                        var mapaEvent = new CustomEvent('pontoIscaAtualizado', {
                            detail: { item: items[index], action: 'update' }
                        });
                        document.dispatchEvent(mapaEvent);
                    }

                    this._isSaving = false;
                    return items[index];
                }
                this._isSaving = false;
                return null;
            } catch (e) {
                this._isSaving = false;
                throw e;
            }
        },

        remove: function (collection, id) {
            var key = this.getFullKey(collection);
            var idStr = String(id);
            var items = JSON.parse(localStorage.getItem(key) || '[]').filter(function (i) { return String(i.id) !== idStr; });
            localStorage.setItem(key, JSON.stringify(items));
            this._clearCache(collection);

            if (typeof FirestoreService !== 'undefined' && !window._firestoreSyncing) {
                try {
                    FirestoreService.delete(collection, id).catch(function (error) {
                        console.warn('⚠️ Erro ao deletar ' + collection + ' ' + id + ' do Firebase:', error);
                    });
                } catch (error) {
                    console.warn('⚠️ Erro ao deletar ' + collection + ' ' + id + ' do Firebase:', error);
                }
            }

            if (collection === 'pontosIscas') {
                var mapaEvent = new CustomEvent('pontoIscaAtualizado', {
                    detail: { id: id, action: 'delete' }
                });
                document.dispatchEvent(mapaEvent);
            }

            return items;
        },

        syncFromFirestore: function (collection, firestoreData) {
            if (window._firestoreSyncing) {
                console.warn('⚠️ Sincronização Firestore já em andamento, ignorando:', collection);
                return;
            }

            window._firestoreSyncing = true;

            try {
                var key = this.getFullKey(collection);
                var localData = JSON.parse(localStorage.getItem(key) || '[]');

                var mergedData = this._mergeData(localData, firestoreData);
                mergedData = this._removeDuplicates(mergedData);

                localStorage.setItem(key, JSON.stringify(mergedData));
                this._clearCache(collection);

                window._firestoreSyncing = false;
                return mergedData;
            } catch (e) {
                console.warn('Erro na sincronização de ' + collection + ':', e);
                window._firestoreSyncing = false;
                return null;
            }
        },

        _mergeData: function (localData, firestoreData) {
            var merged = {};

            localData.forEach(function (item) {
                var id = String(item.id);
                merged[id] = { ...item, _source: 'local' };
            });

            firestoreData.forEach(function (item) {
                var id = String(item.id);
                merged[id] = { ...item, _source: 'firestore' };
            });

            return Object.values(merged);
        },

        forcarSincronizacao: function () {
            if (typeof FirestoreService !== 'undefined') {
                var empresaId = EmpresaManager.getEmpresaAtual();
                return FirestoreService.sincronizarDadosEmpresa(empresaId).then(function (total) {
                    DB._clearAllCaches();
                    renderAll();
                    return total;
                }).catch(function (err) {
                    console.error('❌ Erro na sincronização:', err);
                    throw err;
                });
            } else {
                return Promise.reject('FirestoreService não disponível');
            }
        },

        getConfig: function () {
            try {
                var key = this.getFullKey('configuracoes');
                var configData = localStorage.getItem(key);

                if (configData) {
                    var parsed = JSON.parse(configData);
                    if (!parsed.empresa) parsed.empresa = CONFIG_PADRAO.empresa;
                    if (!parsed.relatorio) parsed.relatorio = CONFIG_PADRAO.relatorio;
                    return parsed;
                }

                localStorage.setItem(key, JSON.stringify(CONFIG_PADRAO));
                return JSON.parse(JSON.stringify(CONFIG_PADRAO));
            } catch (e) {
                console.warn('Erro ao ler configurações, usando padrão:', e);
                return JSON.parse(JSON.stringify(CONFIG_PADRAO));
            }
        },

        setConfig: function (config) {
            var key = this.getFullKey('configuracoes');
            try {
                if (!config.empresa) config.empresa = CONFIG_PADRAO.empresa;
                if (!config.relatorio) config.relatorio = CONFIG_PADRAO.relatorio;

                localStorage.setItem(key, JSON.stringify(config));
                if (typeof ConfigService !== 'undefined') {
                    setTimeout(function () {
                        try {
                            ConfigService.saveConfig(config);
                        } catch (error) {
                            console.warn('Erro ao salvar configurações no Firebase:', error);
                        }
                    }, 100);
                }
            } catch (e) {
                console.warn('Erro ao salvar configurações:', e);
            }
        },

        init: function () {
            var key = this.getFullKey('configuracoes');
            var hasData = localStorage.getItem(key) !== null;

            if (!hasData) {
                var collections = ['configuracoes', 'clientes', 'servicos', 'agenda', 'equipe',
                    'ordens', 'orcamentos', 'pontosIscas', 'relatorios', 'modelos', 'estoque',
                    'movimentacoes', 'historico_mensal', 'ultimo_reset', 'certificados'];
                var self = this;
                collections.forEach(function (col) {
                    localStorage.removeItem(self.getFullKey(col));
                });

                localStorage.setItem(this.getFullKey('configuracoes'), JSON.stringify(CONFIG_PADRAO));
                localStorage.setItem(this.getFullKey('modelos'), JSON.stringify(DADOS_PADRAO.modelos));

            }

            if (typeof FirestoreService !== 'undefined') {
                setTimeout(function () {
                    try {
                        FirestoreService.initializeDefaultData();
                    } catch (error) {
                        console.warn('Erro ao inicializar dados no Firebase:', error);
                    }
                }, 500);
            }
        },

        limparDados: function () {
            var collections = ['configuracoes', 'clientes', 'servicos', 'agenda', 'equipe',
                'ordens', 'orcamentos', 'pontosIscas', 'relatorios', 'modelos', 'estoque',
                'movimentacoes', 'historico_mensal', 'ultimo_reset', 'certificados'];
            var self = this;
            collections.forEach(function (col) {
                localStorage.removeItem(self.getFullKey(col));
                self._clearCache(col);
            });
            this._clearAllCaches();
            this.init();
        }
    };

    // =============================================
    // ===== LISTENERS PARA ATUALIZAÇÃO AUTOMÁTICA =====
    // =============================================

    document.addEventListener('dadosAtualizados', function (e) {
        const detail = e.detail;
        if (!detail) return;

        if (detail.collection === 'relatorios') {
            DB.forceClearCache('relatorios');
            const relatorioPage = document.getElementById('page-relatorios');
            if (relatorioPage && relatorioPage.classList.contains('active')) {
                renderRelatorios();
            }
            const modalOverlay = document.getElementById('modalRelatorioOverlay');
            if (modalOverlay && modalOverlay.classList.contains('active')) {
                const id = window._relatorioVisualizandoId;
                if (id) {
                    setTimeout(function () {
                        visualizarRelatorio(id);
                    }, 100);
                }
            }
        }

        if (detail.collection === 'servicos') {
            const agendaPage = document.getElementById('page-agenda');
            if (agendaPage && agendaPage.classList.contains('active')) {
                renderAgenda();
            }
        }
    });

    document.addEventListener('relatorioAtualizado', function (e) {
        DB.forceClearCache('relatorios');
        var relatorioPage = document.getElementById('page-relatorios');
        if (relatorioPage && relatorioPage.classList.contains('active')) {
            renderRelatorios();
        }
        var modalOverlay = document.getElementById('modalRelatorioOverlay');
        if (modalOverlay && modalOverlay.classList.contains('active')) {
            var id = window._relatorioVisualizandoId;
            if (id) {
                setTimeout(function () {
                    visualizarRelatorio(id);
                }, 100);
            }
        }
    });

    document.addEventListener('estoqueAtualizado', function (e) {
        if (e.detail.action === 'add') {
            var produtos = DB.getAll('estoque', true);
            renderizarTabelaEstoque(produtos);
            atualizarDashboardEstoque();
            atualizarGraficosEstoque();
        }
    });

    document.addEventListener('movimentacaoAtualizada', function (e) {
        var movTab = document.getElementById('tab-movimentacoes');
        if (movTab && movTab.classList.contains('active')) {
            renderMovimentacoes();
        }
        renderHistorico();
    });

    document.addEventListener('certificadoAtualizado', function (e) {
        if (e.detail.action === 'add') {
            renderCertificados();
            preencherFiltroCertificados();
            if (typeof renderAll === 'function') {
                renderAll();
            }
            const item = e.detail.item;
            if (item && item.id) {
                setTimeout(function () {
                    const card = document.getElementById('certificado-card-' + item.id);
                    if (card) {
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        card.style.transition = 'all 0.5s ease';
                        card.style.boxShadow = '0 0 0 3px #1d7a6b, 0 8px 30px rgba(29,122,107,0.3)';
                        setTimeout(function () {
                            card.style.boxShadow = '';
                        }, 3000);
                    }
                }, 200);
            }
        }
    });

    document.addEventListener('pontoIscaAtualizado', function (e) {
        DB.forceClearCache('pontosIscas');
        renderMapaComFiltros();
        preencherFiltrosClientesMapa();
        if (typeof renderAll === 'function') {
            renderAll();
        }
    });

    // =============================================
    // ===== SERVIÇO DE CERTIFICADOS =====
    // =============================================

    const CertificadoService = {
        gerarCertificado: function (servicoId, tipo) {
            const servico = DB.getById('servicos', servicoId);
            if (!servico) {
                throw new Error('Serviço não encontrado!');
            }

            const cliente = getCliente(servico.clienteId);
            if (!cliente) {
                throw new Error('Cliente não encontrado!');
            }

            const config = DB.getConfig();
            const produtos = this._buscarProdutosUtilizados(servico);
            const metodos = this._buscarMetodosEmpregados(servico);

            const empresaPrestadora = {
                nome: config.empresa.nome || 'S. AUGUSTA DA SILVA (Click Saúde Ambiental)',
                cnpj: config.empresa.cnpj || '48.922.299/0001-68',
                alvaraSanitario: '3142.6700/2025',
                licencaAmbiental: '110/2024',
                endereco: config.empresa.endereco || 'rua Dona Rosa da Fonseca, 154, Prado, Maceió/AL'
            };

            const responsaveis = {
                tecnico: {
                    id: null,
                    nome: 'Selecione...',
                    registro: '',
                    atuacao: ''
                },
                operacional: {
                    id: null,
                    nome: 'Selecione...',
                    registro: '',
                    atuacao: ''
                }
            };

            // ✅ CAMPO DE OBSERVAÇÕES VAZIO - profissional deve preencher
            const observacoesPadrao = '';
            
            const tiposServico = servico.tipos || [servico.tipo];

            const certificado = {
                id: 'cert_' + Date.now(),
                servicoId: servico.id,
                clienteId: cliente.id,
                tipo: tipo,
                tiposServico: tiposServico,
                descricaoCompleta: tiposServico.join(' + '),
                dataEmissao: new Date().toISOString(),
                dataServico: servico.data,
                dataValidade: this._calcularDataValidade(servico.data, tipo),

                cliente: {
                    nome: cliente.tipoCliente === 'cnpj' ? (cliente.nomeFantasia || cliente.razaoSocial || cliente.nome) : cliente.nome,
                    razaoSocial: cliente.razaoSocial || '',
                    cnpjCpf: cliente.documento || 'N/A',
                    endereco: cliente.endereco || 'N/A',
                    telefone: cliente.telefone || 'N/A',
                    tipo: cliente.tipoCliente || 'cpf'
                },

                prestadora: empresaPrestadora,
                responsaveis: responsaveis,
                produtos: produtos,
                metodos: metodos,
                observacoes: '', // ✅ CAMPO VAZIO - profissional preenche depois
                telefoneEmergencia: '0800 148110',
                status: 'ativo',
                assinaturaTecnico: null,
                assinaturaOperacional: null,
                criadoEm: new Date().toISOString()
            };

            const certificadoSalvo = DB.add('certificados', certificado);

            if (typeof FirestoreService !== 'undefined') {
                try {
                    FirestoreService.sincronizarColecao('certificados').then(() => {
                    }).catch(err => {
                        console.warn('⚠️ Erro ao sincronizar certificado:', err);
                    });
                } catch (e) {
                    console.warn('⚠️ Erro ao sincronizar certificado:', e);
                }
            }

            setTimeout(function () {
                document.dispatchEvent(new CustomEvent('certificadoAtualizado', {
                    detail: { certificado: certificadoSalvo, action: 'add', item: certificadoSalvo }
                }));
            }, 100);

            return certificadoSalvo;
        },

        gerarCertificadoCombinado: function (servicoId, tipoPrincipal, todosTipos) {
            const servico = DB.getById('servicos', servicoId);
            if (!servico) {
                throw new Error('Serviço não encontrado!');
            }

            const cliente = getCliente(servico.clienteId);
            if (!cliente) {
                throw new Error('Cliente não encontrado!');
            }

            const config = DB.getConfig();
            const produtos = this._buscarProdutosUtilizados(servico);
            const metodos = this._buscarMetodosEmpregados(servico);

            const empresaPrestadora = {
                nome: config.empresa.nome || 'S. AUGUSTA DA SILVA (Click Saúde Ambiental)',
                cnpj: config.empresa.cnpj || '48.922.299/0001-68',
                alvaraSanitario: '3142.6700/2025',
                licencaAmbiental: '110/2024',
                endereco: config.empresa.endereco || 'rua Dona Rosa da Fonseca, 154, Prado, Maceió/AL'
            };

            const responsaveis = {
                tecnico: {
                    id: null,
                    nome: 'Selecione...',
                    registro: '',
                    atuacao: ''
                },
                operacional: {
                    id: null,
                    nome: 'Selecione...',
                    registro: '',
                    atuacao: ''
                }
            };

            // ✅ CAMPO DE OBSERVAÇÕES VAZIO - profissional deve preencher
            const observacoesCombinadas = '';

            const tiposStr = todosTipos.join(' + ');

            const certificado = {
                id: 'cert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                servicoId: servico.id,
                clienteId: cliente.id,
                tipo: tipoPrincipal,
                tiposServico: todosTipos,
                descricaoCompleta: tiposStr,
                isCombinado: true,
                dataEmissao: new Date().toISOString(),
                dataServico: servico.data,
                dataValidade: this._calcularDataValidade(servico.data, tipoPrincipal),

                cliente: {
                    nome: cliente.tipoCliente === 'cnpj' ? (cliente.nomeFantasia || cliente.razaoSocial || cliente.nome) : cliente.nome,
                    razaoSocial: cliente.razaoSocial || '',
                    cnpjCpf: cliente.documento || 'N/A',
                    endereco: cliente.endereco || 'N/A',
                    telefone: cliente.telefone || 'N/A',
                    tipo: cliente.tipoCliente || 'cpf'
                },

                prestadora: empresaPrestadora,
                responsaveis: responsaveis,
                produtos: produtos,
                metodos: metodos,
                observacoes: '', // ✅ CAMPO VAZIO - profissional preenche depois
                telefoneEmergencia: '0800 148110',
                status: 'ativo',
                assinaturaTecnico: null,
                assinaturaOperacional: null,
                criadoEm: new Date().toISOString()
            };

            const certificadoSalvo = DB.add('certificados', certificado);

            if (typeof FirestoreService !== 'undefined') {
                try {
                    FirestoreService.sincronizarColecao('certificados').then(() => {
                    }).catch(err => {
                        console.warn('⚠️ Erro ao sincronizar certificado:', err);
                    });
                } catch (e) {
                    console.warn('⚠️ Erro ao sincronizar certificado:', e);
                }
            }

            setTimeout(function () {
                document.dispatchEvent(new CustomEvent('certificadoAtualizado', {
                    detail: { certificado: certificadoSalvo, action: 'add', item: certificadoSalvo }
                }));
            }, 100);

            return certificadoSalvo;
        },

        gerarCertificadoComProdutos: function (servicoId, tipo, produtosSelecionados) {
            var servico = DB.getById('servicos', servicoId);
            if (!servico) {
                throw new Error('Serviço não encontrado!');
            }

            var cliente = getCliente(servico.clienteId);
            if (!cliente) {
                throw new Error('Cliente não encontrado!');
            }

            var config = DB.getConfig();
            var metodos = this._buscarMetodosEmpregados(servico);

            var empresaPrestadora = {
                nome: config.empresa.nome || 'S. AUGUSTA DA SILVA (Click Saúde Ambiental)',
                cnpj: config.empresa.cnpj || '48.922.299/0001-68',
                alvaraSanitario: '3142.6700/2025',
                licencaAmbiental: '110/2024',
                endereco: config.empresa.endereco || 'rua Dona Rosa da Fonseca, 154, Prado, Maceió/AL'
            };

            var responsaveis = {
                tecnico: {
                    id: null,
                    nome: 'Selecione...',
                    registro: '',
                    atuacao: ''
                },
                operacional: {
                    id: null,
                    nome: 'Selecione...',
                    registro: '',
                    atuacao: ''
                }
            };

            // ✅ CAMPO DE OBSERVAÇÕES VAZIO - profissional deve preencher
            var observacoesPadrao = '';
            
            var tiposServico = servico.tipos || [servico.tipo];

            var produtosFormatados = [];
            for (var i = 0; i < produtosSelecionados.length; i++) {
                var p = produtosSelecionados[i];
                produtosFormatados.push({
                    nome: p.nome || '',
                    registroMs: p.registroMs || p.registro || '',
                    grupoQuimico: p.grupoQuimico || p.gQuimico || '',
                    principioAtivo: p.principioAtivo || p.pAtivo || '',
                    concentracao: p.concentracao || p.porcentagem || '',
                    tratamento: p.tratamento || 'Sintomático',
                    quantidade: p.quantidade || 1,
                    unidade: p.unidade || ''
                });
            }

            var certificado = {
                id: 'cert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                servicoId: servico.id,
                clienteId: cliente.id,
                tipo: tipo,
                tiposServico: tiposServico,
                descricaoCompleta: tiposServico.join(' + '),
                dataEmissao: new Date().toISOString(),
                dataServico: servico.data,
                dataValidade: this._calcularDataValidade(servico.data, tipo),
                cliente: {
                    nome: cliente.tipoCliente === 'cnpj' ? (cliente.nomeFantasia || cliente.razaoSocial || cliente.nome) : cliente.nome,
                    razaoSocial: cliente.razaoSocial || '',
                    cnpjCpf: cliente.documento || 'N/A',
                    endereco: cliente.endereco || 'N/A',
                    telefone: cliente.telefone || 'N/A',
                    tipo: cliente.tipoCliente || 'cpf'
                },
                prestadora: empresaPrestadora,
                responsaveis: responsaveis,
                produtos: produtosFormatados,
                metodos: metodos,
                observacoes: '', // ✅ CAMPO VAZIO - profissional preenche depois
                telefoneEmergencia: '0800 148110',
                status: 'ativo',
                assinaturaTecnico: null,
                assinaturaOperacional: null,
                criadoEm: new Date().toISOString()
            };

            var certificadoSalvo = DB.add('certificados', certificado);

            if (typeof FirestoreService !== 'undefined') {
                try {
                    FirestoreService.sincronizarColecao('certificados').then(function() {
                    }).catch(function(err) {
                        console.warn('⚠️ Erro ao sincronizar certificado:', err);
                    });
                } catch (e) {
                    console.warn('⚠️ Erro ao sincronizar certificado:', e);
                }
            }

            setTimeout(function () {
                document.dispatchEvent(new CustomEvent('certificadoAtualizado', {
                    detail: { certificado: certificadoSalvo, action: 'add', item: certificadoSalvo }
                }));
            }, 100);

            return certificadoSalvo;
        },

        _buscarProdutosUtilizados: function (servico) {
            if (servico.produtosUtilizados && servico.produtosUtilizados.length > 0) {
                return servico.produtosUtilizados;
            }

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

        _buscarMetodosEmpregados: function (servico) {
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

        // ✅ FUNÇÃO CORRIGIDA - CAMPO DE OBSERVAÇÕES VAZIO
        _gerarObservacoesPorTipo: function (tipo, produtos) {
            // Campo vazio para o profissional preencher manualmente
            return '';
        },

        _calcularDataValidade: function (dataServico, tipo) {
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

        renderizarCertificado: function (certificado) {
            if (!certificado) return '<p>Certificado não encontrado</p>';

            const c = certificado;

            const equipe = DB.getAll('equipe');

            const tecnicos = equipe.filter(m => {
                const cargo = (m.cargo || '').toLowerCase();
                return cargo.includes('técnico') ||
                    cargo.includes('farmacêutico') ||
                    cargo.includes('responsável') ||
                    cargo.includes('tecnico') ||
                    cargo.includes('especialista');
            });

            const operacionais = equipe.filter(m => {
                const cargo = (m.cargo || '').toLowerCase();
                return cargo.includes('operacional') ||
                    cargo.includes('coordenador') ||
                    cargo.includes('suporte') ||
                    cargo.includes('campo');
            });

            if (tecnicos.length === 0) {
                tecnicos.push({
                    id: 'default_tecnico',
                    nome: 'Nenhum técnico cadastrado',
                    cargo: 'Cadastre um técnico na equipe',
                    registro: ''
                });
            }

            if (operacionais.length === 0) {
                operacionais.push({
                    id: 'default_operacional',
                    nome: 'Nenhum operacional cadastrado',
                    cargo: 'Cadastre um operacional na equipe',
                    registro: ''
                });
            }

            const tecnicoAtual = c.responsaveis?.tecnico || { id: null, nome: 'Selecione...', registro: '', atuacao: '' };
            const operacionalAtual = c.responsaveis?.operacional || { id: null, nome: 'Selecione...', registro: '', atuacao: '' };

            const tecnicoOptions = tecnicos.map(m => {
                const isSelected = (m.id !== null && tecnicoAtual.id !== null && String(m.id) === String(tecnicoAtual.id));
                return `<option value="${m.id}" ${isSelected ? 'selected' : ''}>${m.nome} - ${m.cargo}</option>`;
            }).join('');

            const operacionalOptions = operacionais.map(m => {
                const isSelected = (m.id !== null && operacionalAtual.id !== null && String(m.id) === String(operacionalAtual.id));
                return `<option value="${m.id}" ${isSelected ? 'selected' : ''}>${m.nome} - ${m.cargo}</option>`;
            }).join('');

            const tecnicoSelecionado = tecnicos.find(m => String(m.id) === String(tecnicoAtual.id));
            const operacionalSelecionado = operacionais.find(m => String(m.id) === String(operacionalAtual.id));

            const tecnicoTemAssinatura = tecnicoSelecionado ?
                (tecnicoSelecionado.assinaturaTecnico ? true : false) : false;
            const operacionalTemAssinatura = operacionalSelecionado ?
                (operacionalSelecionado.assinaturaOperacional ? true : false) : false;

            const produtosHtml = c.produtos.map(p => `
                <tr>
                    <td style="padding:6px 10px;border:1px solid #ccc;text-align:center;font-size:12px;">${p.nome || '-'}</td>
                    <td style="padding:6px 10px;border:1px solid #ccc;text-align:center;font-size:12px;">${p.registroMs || '-'}</td>
                    <td style="padding:6px 10px;border:1px solid #ccc;text-align:center;font-size:12px;">${p.grupoQuimico || '-'}</td>
                    <td style="padding:6px 10px;border:1px solid #ccc;text-align:center;font-size:12px;">${p.principioAtivo || '-'}</td>
                    <td style="padding:6px 10px;border:1px solid #ccc;text-align:center;font-size:12px;">${p.concentracao || '-'}</td>
                    <td style="padding:6px 10px;border:1px solid #ccc;text-align:center;font-size:12px;">${p.tratamento || 'Sintomático'}</td>
                </tr>
            `).join('');

            const clienteInfo = c.cliente;
            const clienteNome = clienteInfo.tipo === 'cnpj' ?
                (clienteInfo.nome || clienteInfo.razaoSocial) :
                clienteInfo.nome;

            const tecnicoDisplay = tecnicoSelecionado ?
                `${tecnicoSelecionado.nome} - ${tecnicoSelecionado.registro || 'Sem registro'}` :
                'Nenhum técnico selecionado';

            const operacionalDisplay = operacionalSelecionado ?
                `${operacionalSelecionado.nome} - ${operacionalSelecionado.registro || 'Sem registro'}` :
                'Nenhum operacional selecionado';

            let tiposExibicao = [c.tipo];
            if (c.tiposServico && c.tiposServico.length > 0) {
                tiposExibicao = c.tiposServico;
            } else {
                const servicoOriginal = DB.getById('servicos', c.servicoId);
                if (servicoOriginal && servicoOriginal.tipos && servicoOriginal.tipos.length > 0) {
                    tiposExibicao = servicoOriginal.tipos;
                }
            }
            const tiposStr = tiposExibicao.join(' + ');

            const botoesAssinaturaHtml = `
                <div style="grid-column:1/-1;display:flex;gap:10px;margin-top:6px;flex-wrap:wrap;justify-content:center;">
                    ${tecnicoTemAssinatura ? `
                        <button onclick="aplicarAssinaturaSalvaCertificado('${c.id}', 'tecnico')" 
                                style="background:#1d7a6b;color:white;border:none;padding:5px 18px;border-radius:4px;font-size:10px;cursor:pointer;display:flex;align-items:center;gap:6px;">
                            <i class="fas fa-check-circle"></i> Aplicar Assinatura Salva (Técnico)
                        </button>
                    ` : tecnicoSelecionado && tecnicoSelecionado.id !== 'default_tecnico' ? `
                        <button onclick="abrirGerenciadorAssinaturas()" 
                                style="background:#e67e22;color:white;border:none;padding:5px 18px;border-radius:4px;font-size:10px;cursor:pointer;display:flex;align-items:center;gap:6px;">
                            <i class="fas fa-exclamation-triangle"></i> Adicionar Assinatura (Técnico)
                        </button>
                    ` : ''}
                    ${operacionalTemAssinatura ? `
                        <button onclick="aplicarAssinaturaSalvaCertificado('${c.id}', 'operacional')" 
                                style="background:#1d7a6b;color:white;border:none;padding:5px 18px;border-radius:4px;font-size:10px;cursor:pointer;display:flex;align-items:center;gap:6px;">
                            <i class="fas fa-check-circle"></i> Aplicar Assinatura Salva (Operacional)
                        </button>
                    ` : operacionalSelecionado && operacionalSelecionado.id !== 'default_operacional' ? `
                        <button onclick="abrirGerenciadorAssinaturas()" 
                                style="background:#e67e22;color:white;border:none;padding:5px 18px;border-radius:4px;font-size:10px;cursor:pointer;display:flex;align-items:center;gap:6px;">
                            <i class="fas fa-exclamation-triangle"></i> Adicionar Assinatura (Operacional)
                        </button>
                    ` : ''}
                    <button onclick="abrirGerenciadorAssinaturas()" 
                            style="background:#0b2a3b;color:white;border:none;padding:5px 18px;border-radius:4px;font-size:10px;cursor:pointer;display:flex;align-items:center;gap:6px;">
                        <i class="fas fa-cog"></i> Gerenciar Assinaturas
                    </button>
                </div>
            `;

            return `
                <div style="font-family:Arial,sans-serif;font-size:13px;max-width:800px;margin:0 auto;padding:24px;background:white;border:1px solid #ddd;border-radius:8px;line-height:1.6;">
                    <div style="display:flex;align-items:center;gap:20px;border-bottom:3px solid #0b2a3b;padding-bottom:16px;margin-bottom:20px;">
                        <div style="flex-shrink:0;">
                            <svg viewBox="0 0 100 100" width="70" height="70" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                            <div style="font-size:24px;font-weight:700;color:#0b2a3b;">${c.prestadora.nome}</div>
                            <div style="font-size:12px;color:#4d687a;">
                                CNPJ: ${c.prestadora.cnpj} | Alvará Sanitário: ${c.prestadora.alvaraSanitario} | Licença Ambiental: ${c.prestadora.licencaAmbiental}
                            </div>
                            <div style="font-size:12px;color:#4d687a;">${c.prestadora.endereco}</div>
                        </div>
                    </div>

                    <div style="text-align:center;font-size:22px;font-weight:700;color:#0b2a3b;margin:16px 0 12px;letter-spacing:2px;">
                        CERTIFICADO TÉCNICO
                    </div>

                    <div style="font-size:13px;line-height:1.7;">
                        <p style="margin:8px 0;">
                            Certificamos que foi prestado o serviço de <strong>${tiposStr}</strong> em 
                            <strong>${c.dataServico}</strong>, à empresa: <strong>${clienteNome}</strong>
                            ${clienteInfo.razaoSocial ? `(${clienteInfo.razaoSocial})` : ''},
                            inscrita no ${clienteInfo.tipo === 'cnpj' ? 'CNPJ' : 'CPF'} n° ${clienteInfo.cnpjCpf},
                            situada à ${clienteInfo.endereco}, pela ${c.prestadora.nome}, utilizando produtos 
                            domissanitários em conformidade com a legislação em vigor.
                        </p>
                        
                        ${tiposExibicao.length > 1 ? `
                            <div style="margin:8px 0;padding:8px 14px;background:#f0f7fc;border-radius:6px;border-left:4px solid #1d7a6b;">
                                <strong style="color:#0b2a3b;">📋 Serviços Realizados:</strong>
                                <span style="color:#4d687a;">${tiposExibicao.join(' + ')}</span>
                            </div>
                        ` : ''}

                        <div style="margin:16px 0;">
                            <div style="font-weight:700;font-size:15px;margin-bottom:6px;color:#0b2a3b;">Produtos utilizados:</div>
                            <table style="width:100%;border-collapse:collapse;font-size:12px;">
                                <thead>
                                    <tr style="background:#0b2a3b;color:white;">
                                        <th style="padding:6px 10px;border:1px solid #0b2a3b;text-align:center;font-size:11px;">PRODUTO</th>
                                        <th style="padding:6px 10px;border:1px solid #0b2a3b;text-align:center;font-size:11px;">REG. MS</th>
                                        <th style="padding:6px 10px;border:1px solid #0b2a3b;text-align:center;font-size:11px;">GRUPO QUÍMICO</th>
                                        <th style="padding:6px 10px;border:1px solid #0b2a3b;text-align:center;font-size:11px;">PRINCÍPIO ATIVO</th>
                                        <th style="padding:6px 10px;border:1px solid #0b2a3b;text-align:center;font-size:11px;">CONCENTRAÇÃO</th>
                                        <th style="padding:6px 10px;border:1px solid #0b2a3b;text-align:center;font-size:11px;">TRATAMENTO</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${produtosHtml || '<tr><td colspan="6" style="text-align:center;padding:10px;font-size:12px;">Nenhum produto registrado</td></tr>'}
                                </tbody>
                            </table>
                        </div>

                        <div style="margin:14px 0;padding:10px 16px;background:#f8fbfd;border-left:4px solid #0b2a3b;border-radius:4px;">
                            <div style="font-weight:700;font-size:13px;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                                <span>OBSERVAÇÕES:</span>
                                <button onclick="editarObservacaoCertificado('${c.id}')" style="background:#0b2a3b;color:white;border:none;border-radius:4px;padding:4px 16px;font-size:11px;cursor:pointer;">
                                    <i class="fas fa-edit"></i> Editar
                                </button>
                            </div>
                            <div id="certObservacao_${c.id}" 
                                 style="font-size:12px;white-space:pre-wrap;word-wrap:break-word;color:#1f3a4b;min-height:50px;max-height:200px;overflow-y:auto;padding:10px 12px;border:1px solid #dce4ec;border-radius:4px;background:white;line-height:1.7;font-family:inherit;"
                                 contenteditable="true"
                                 onkeydown="handleObservacaoEnter(event, '${c.id}')"
                                 onblur="salvarObservacaoCertificado('${c.id}', this.innerHTML)">
                                ${c.observacoes || 'Clique aqui para adicionar observações... Pressione Enter para quebrar linha.'}
                            </div>
                            <div style="font-size:10px;color:#999;margin-top:4px;">💡 Pressione Enter para quebrar linha</div>
                        </div>

                        <div style="margin:14px 0;">
                            <div style="font-weight:700;font-size:15px;color:#0b2a3b;">Métodos Empregados:</div>
                            <div style="font-size:12px;padding:6px 12px;background:#fafcfe;border-radius:4px;border:1px solid #e8eff5;">
                                ${c.metodos.descricao || 'Não informado'}
                                ${c.metodos.pragasAlvo && c.metodos.pragasAlvo.length > 0 ?
                    `<br><strong>Pragas-Alvo:</strong> ${c.metodos.pragasAlvo.join(', ')}` : ''}
                                <br><strong>Data da Execução:</strong> ${c.dataServico} 
                                <strong>Data de Validade:</strong> ${c.dataValidade}
                            </div>
                        </div>

                        <div style="margin:14px 0;">
                            <div style="font-weight:700;font-size:15px;margin-bottom:8px;color:#0b2a3b;">Responsáveis Técnicos:</div>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
                                <div style="padding:12px 16px;background:#f8fbfd;border-radius:6px;border:1px solid #e8eff5;">
                                    <div style="font-weight:600;font-size:12px;color:#0b2a3b;margin-bottom:6px;">RESPONSÁVEL TÉCNICO</div>
                                    <select id="certTecnicoSelect_${c.id}" 
                                            style="width:100%;padding:6px 10px;border:1px solid #dce4ec;border-radius:4px;font-size:11px;background:white;margin-bottom:6px;" 
                                            onchange="atualizarResponsavelCertificado('${c.id}', 'tecnico', this.value)">
                                        <option value="">Selecione...</option>
                                        ${tecnicoOptions}
                                    </select>
                                    <div style="font-size:11px;color:#4d687a;margin-bottom:6px;" id="certTecnicoInfo_${c.id}">
                                        ${tecnicoDisplay}
                                    </div>
                                    <div style="margin:6px auto 0;width:100%;min-height:60px;border:1px solid #ccc;border-radius:4px;background:white;display:flex;align-items:center;justify-content:center;cursor:pointer;" 
                                         onclick="abrirAssinaturaCertificado('${c.id}', 'tecnico')">
                                        ${c.assinaturaTecnico ?
                    `<img src="${c.assinaturaTecnico}" style="max-height:55px;max-width:100%;" />` :
                    '<span style="font-size:10px;color:#999;">Clique para assinar</span>'}
                                    </div>
                                    <div style="font-size:9px;text-align:center;color:#999;margin-top:3px;">Assinatura Digital</div>
                                </div>

                                <div style="padding:12px 16px;background:#f8fbfd;border-radius:6px;border:1px solid #e8eff5;">
                                    <div style="font-weight:600;font-size:12px;color:#0b2a3b;margin-bottom:6px;">RESPONSÁVEL OPERACIONAL</div>
                                    <select id="certOperacionalSelect_${c.id}" 
                                            style="width:100%;padding:6px 10px;border:1px solid #dce4ec;border-radius:4px;font-size:11px;background:white;margin-bottom:6px;"
                                            onchange="atualizarResponsavelCertificado('${c.id}', 'operacional', this.value)">
                                        <option value="">Selecione...</option>
                                        ${operacionalOptions}
                                    </select>
                                    <div style="font-size:11px;color:#4d687a;margin-bottom:6px;" id="certOperacionalInfo_${c.id}">
                                        ${operacionalDisplay}
                                    </div>
                                    <div style="margin:6px auto 0;width:100%;min-height:60px;border:1px solid #ccc;border-radius:4px;background:white;display:flex;align-items:center;justify-content:center;cursor:pointer;"
                                         onclick="abrirAssinaturaCertificado('${c.id}', 'operacional')">
                                        ${c.assinaturaOperacional ?
                    `<img src="${c.assinaturaOperacional}" style="max-height:55px;max-width:100%;" />` :
                    '<span style="font-size:10px;color:#999;">Clique para assinar</span>'}
                                    </div>
                                    <div style="font-size:9px;text-align:center;color:#999;margin-top:3px;">Assinatura Digital</div>
                                </div>
                                ${botoesAssinaturaHtml}
                            </div>
                        </div>

                        <div style="margin:14px 0;padding:8px 14px;background:#fde8e6;border-radius:4px;border-left:4px solid #c0392b;">
                            <div style="font-weight:700;font-size:12px;color:#b13e3a;">Primeiros Socorros:</div>
                            <div style="font-size:11px;">Em caso de ingestão acidental, provoque o vômito e procure imediatamente o serviço de atendimento médico.</div>
                            <div style="font-size:11px;font-weight:600;color:#b13e3a;">Telefone de Emergência: ${c.telefoneEmergencia} (Centro de Informação Toxicológica)</div>
                            <div style="font-size:11px;color:#b13e3a;">Atenção: O ambiente passa por manutenção a cada 30 dias.</div>
                        </div>
                        </div>
                    </div>
                </div>
            `;
        },

        _getTipoLabel: function (tipo) {
            const map = {
                'Desinsetização': 'DESINSETIZAÇÃO',
                'Desratização': 'DESRATIZAÇÃO',
                'Descupinização': 'DESCUPINIZAÇÃO'
            };
            return map[tipo] || tipo.toUpperCase();
        },

       gerarPDF: function (certificado) {
    var html = this.renderizarCertificado(certificado);

    var win = window.open('', '_blank', 'width=700,height=500');
    if (win) {
        win.document.write(`
            <html>
            <head>
                <meta charset="UTF-8" />
                <title>Certificado Técnico</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" />
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        margin: 0; 
                        padding: 0; 
                        background: white; 
                        font-family: Arial, sans-serif;
                    }
                    
                    @page {
                        size: A4;
                        margin: 5mm 8mm 5mm 8mm;
                    }
                    
                    @media print {
                        body { padding: 0; margin: 0; }
                        .no-print { display: none !important; }
                        .cert-print {
                            page-break-after: avoid !important;
                            page-break-inside: avoid !important;
                            break-inside: avoid !important;
                        }
                        /* 🔥 OCULTA TODOS OS BOTÕES NA IMPRESSÃO */
                        button {
                            display: none !important;
                        }
                        .btn-gerenciar-assinaturas {
                            display: none !important;
                        }
                        /* 🔥 OCULTA O SELECT (drop-down) NA IMPRESSÃO - mostra apenas o texto */
                        select {
                            display: none !important;
                        }
                        /* 🔥 MOSTRA O TEXTO SELECIONADO NO LUGAR DO SELECT */
                        .info-text {
                            display: block !important;
                            font-weight: bold;
                            color: #0b2a3b;
                        }
                        /* 🔥 Área de assinatura fica apenas como imagem */
                        .assinatura-area {
                            cursor: default !important;
                            border: 1px solid #ccc !important;
                            min-height: 25px !important;
                        }
                        .assinatura-area span {
                            display: none !important;
                        }
                    }
                    
                    /* 🔥 VISÍVEL NA TELA, OCULTO NA IMPRESSÃO */
                    .btn-gerenciar-assinaturas {
                        text-align: center;
                        margin-top: 4px;
                    }
                    .btn-gerenciar-assinaturas button {
                        background: #0b2a3b;
                        color: white;
                        border: none;
                        padding: 3px 16px;
                        border-radius: 4px;
                        font-size: 7.5pt;
                        cursor: pointer;
                    }
                    
                    .cert-print {
                        font-family: Arial, sans-serif;
                        font-size: 8.5pt;
                        max-width: 100%;
                        margin: 0 auto;
                        padding: 4px 6px;
                        line-height: 1.25;
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    
                    .cert-print .header-empresa {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        border-bottom: 2.5px solid #0b2a3b;
                        padding-bottom: 4px;
                        margin-bottom: 4px;
                    }
                    .cert-print .header-empresa .logo svg {
                        width: 38px;
                        height: 38px;
                    }
                    .cert-print .header-empresa .info h1 {
                        font-size: 12pt;
                        color: #0b2a3b;
                        margin: 0;
                    }
                    .cert-print .header-empresa .info p {
                        font-size: 6pt;
                        color: #4d687a;
                        margin: 0;
                        line-height: 1.2;
                    }
                    
                    .cert-print .titulo {
                        text-align: center;
                        font-size: 12pt;
                        font-weight: 700;
                        color: #0b2a3b;
                        margin: 3px 0 4px;
                        letter-spacing: 2px;
                    }
                    
                    .cert-print .conteudo {
                        font-size: 8pt;
                        line-height: 1.3;
                    }
                    .cert-print .conteudo p {
                        margin: 2px 0;
                    }
                    
                    .cert-print .multi-servicos {
                        margin: 2px 0;
                        padding: 3px 10px;
                        background: #f0f7fc;
                        border-radius: 4px;
                        border-left: 3px solid #1d7a6b;
                        font-size: 7.5pt;
                    }
                    
                    .cert-print table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 6.5pt;
                        margin: 2px 0;
                    }
                    .cert-print table th {
                        background: #0b2a3b;
                        color: white;
                        padding: 1.5px 4px;
                        border: 1px solid #0b2a3b;
                        text-align: center;
                        font-size: 6pt;
                    }
                    .cert-print table td {
                        padding: 1.5px 4px;
                        border: 1px solid #ccc;
                        text-align: center;
                        font-size: 6pt;
                    }
                    
                    .cert-print .info-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 6px;
                        margin: 3px 0;
                    }
                    .cert-print .info-grid .box {
                        padding: 3px 8px;
                        background: #f8fbfd;
                        border-radius: 4px;
                        border-left: 3px solid #0b2a3b;
                    }
                    .cert-print .info-grid .box .label {
                        font-weight: 700;
                        font-size: 7.5pt;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .cert-print .info-grid .box .label button {
                        background: #0b2a3b;
                        color: white;
                        border: none;
                        border-radius: 3px;
                        padding: 0 8px;
                        font-size: 6.5pt;
                        cursor: pointer;
                    }
                    .cert-print .info-grid .box .content {
                        font-size: 7pt;
                        padding: 2px 5px;
                        background: white;
                        border: 1px solid #dce4ec;
                        border-radius: 3px;
                        min-height: 20px;
                        max-height: 45px;
                        overflow-y: auto;
                        white-space: pre-wrap;
                        word-wrap: break-word;
                        margin-top: 1px;
                        line-height: 1.3;
                    }
                    .cert-print .info-grid .box .content-metodos {
                        font-size: 7pt;
                        padding: 2px 6px;
                        background: #fafcfe;
                        border: 1px solid #e8eff5;
                        border-radius: 3px;
                        margin-top: 1px;
                        max-height: 45px;
                        overflow-y: auto;
                    }
                    
                    .cert-print .responsaveis-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 8px;
                        margin: 2px 0;
                    }
                    .cert-print .responsaveis-grid .resp-card {
                        padding: 4px 8px;
                        background: #f8fbfd;
                        border-radius: 4px;
                        border: 1px solid #e8eff5;
                    }
                    .cert-print .responsaveis-grid .resp-card .title {
                        font-weight: 600;
                        font-size: 7.5pt;
                        color: #0b2a3b;
                        margin-bottom: 2px;
                    }
                    .cert-print .responsaveis-grid .resp-card select {
                        width: 100%;
                        padding: 1px 4px;
                        border: 1px solid #dce4ec;
                        border-radius: 3px;
                        font-size: 7pt;
                        background: white;
                        margin-bottom: 2px;
                    }
                    .cert-print .responsaveis-grid .resp-card .info-text {
                        font-size: 7pt;
                        color: #4d687a;
                        margin-bottom: 2px;
                    }
                    .cert-print .responsaveis-grid .resp-card .assinatura-area {
                        width: 100%;
                        min-height: 30px;
                        border: 1px solid #ccc;
                        border-radius: 3px;
                        background: white;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                    }
                    .cert-print .responsaveis-grid .resp-card .assinatura-area img {
                        max-height: 25px;
                        max-width: 100%;
                    }
                    .cert-print .responsaveis-grid .resp-card .assinatura-area span {
                        font-size: 6.5pt;
                        color: #999;
                    }
                    
                    .cert-print .primeiros-socorros {
                        margin: 3px 0;
                        padding: 3px 10px;
                        background: #fde8e6;
                        border-radius: 3px;
                        border-left: 3px solid #c0392b;
                        font-size: 7pt;
                    }
                    .cert-print .primeiros-socorros .title {
                        font-weight: 700;
                        color: #b13e3a;
                    }
                    .cert-print .primeiros-socorros .emergencia {
                        font-weight: 600;
                        color: #b13e3a;
                    }
                    
                    .cert-print .footer {
                        font-size: 5.5pt;
                        text-align: center;
                        color: #6a7f8d;
                        border-top: 1px solid #e8eff5;
                        padding-top: 2px;
                        margin-top: 3px;
                    }
                    
                    .no-print {
                        text-align: center;
                        margin-top: 6px;
                    }
                    .no-print button {
                        padding: 5px 18px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 8.5pt;
                        border: none;
                    }
                    .no-print .btn-print {
                        background: #0b2a3b;
                        color: white;
                    }
                    .no-print .btn-close {
                        background: #e8eff5;
                        color: #1f3a4b;
                        margin-left: 6px;
                    }
                    
                    @media print {
                        .cert-print {
                            font-size: 8pt;
                            padding: 2px 4px;
                        }
                        .cert-print .header-empresa .info h1 {
                            font-size: 11pt;
                        }
                        .cert-print .titulo {
                            font-size: 11pt;
                        }
                        .cert-print table {
                            font-size: 6pt;
                        }
                        .cert-print table th,
                        .cert-print table td {
                            padding: 1px 3px;
                            font-size: 5.5pt;
                        }
                        .cert-print .info-grid .box .content {
                            max-height: 35px;
                            font-size: 6.5pt;
                        }
                        .cert-print .responsaveis-grid .resp-card .assinatura-area {
                            min-height: 25px;
                        }
                        .cert-print .responsaveis-grid .resp-card .assinatura-area img {
                            max-height: 20px;
                        }
                        /* 🔥 GARANTE QUE O BOTÃO "GERENCIAR ASSINATURAS" NÃO APAREÇA */
                        .btn-gerenciar-assinaturas {
                            display: none !important;
                        }
                        .btn-gerenciar-assinaturas button {
                            display: none !important;
                        }
                        /* 🔥 OCULTA SELECTS NA IMPRESSÃO */
                        select {
                            display: none !important;
                        }
                        /* 🔥 MOSTRA O TEXTO DO SELECT NA IMPRESSÃO */
                        .info-text {
                            display: block !important;
                            font-weight: 600;
                            color: #0b2a3b;
                            font-size: 7.5pt;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="cert-print">
                    ${html}
                </div>
                <div class="no-print">
                    <button class="btn-print" onclick="window.print()">
                        <i class="fas fa-print"></i> Imprimir / Salvar PDF
                    </button>
                    <button class="btn-close" onclick="window.close()">
                        Fechar
                    </button>
                </div>
                <script>
                    window.onload = function() { 
                        setTimeout(function() {
                            window.print(); 
                        }, 500);
                    }
                <\/script>
            </body>
            </html>
        `);
        win.document.close();
    }
},

        listarCertificados: function (filtro) {
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

        getCertificado: function (id) {
            return DB.getById('certificados', id);
        }
    };

    window.CertificadoService = CertificadoService;

// =============================================
// ===== FUNÇÕES DE CERTIFICADOS (GLOBAIS) =====
// =============================================

// =============================================
// ===== FUNÇÃO CORRIGIDA PARA CARREGAR PRODUTOS NO CERTIFICADO =====
// =============================================
window.carregarProdutosCertificado = function() {
    try {
        if (typeof DB === 'undefined') {
            console.warn('DB não disponível em carregarProdutosCertificado');
            setTimeout(window.carregarProdutosCertificado, 300);
            return;
        }

        var servicoId = parseInt(document.getElementById('modalCertServico')?.value || '0');
        var container = document.getElementById('certProdutosLista');
        var contador = document.getElementById('produtosSelecionadosContador');
        
        if (!servicoId || !container) {
            console.warn('Serviço ou container não encontrado');
            return;
        }
        
        
        var servico = DB.getById('servicos', servicoId);
        if (!servico) {
            console.warn('Serviço não encontrado:', servicoId);
            container.innerHTML = '<div style="text-align:center;color:#999;padding:10px;">Serviço não encontrado</div>';
            if (contador) contador.textContent = '0 selecionados';
            return;
        }
        
        // 1. Tenta buscar da OS vinculada
        var produtos = [];
        var ordens = DB.getAll('ordens');
        var osVinculada = null;
        for (var i = 0; i < ordens.length; i++) {
            if (ordens[i].servicoId === servico.id) {
                osVinculada = ordens[i];
                break;
            }
        }
        
        if (osVinculada && osVinculada.inseticidasUtilizados && osVinculada.inseticidasUtilizados.length > 0) {
            produtos = osVinculada.inseticidasUtilizados;
        } 
        // 2. Se não tiver na OS, tenta do serviço
        else if (servico.produtosUtilizados && servico.produtosUtilizados.length > 0) {
            produtos = servico.produtosUtilizados;
        } 
        
        // 3. Fallback: produtos padrão
        else {
            var produtosPadrao = {
                'Desinsetização': [
                    { id: 'padrao_1', nome: 'Bifentol', registroMs: '32398.0027', grupoQuimico: 'Piretroide', principioAtivo: 'Bifentrina', concentracao: '1%', tratamento: 'Sintomático' },
                    { id: 'padrao_2', nome: 'Baramid', registroMs: '33308.0014', grupoQuimico: 'Amidino hidrazona', principioAtivo: 'Hidrometil-nona', concentracao: '2%', tratamento: 'Sintomático' },
                    { id: 'padrao_3', nome: 'Formifim', registroMs: '323980002', grupoQuimico: 'Neonicotinoide', principioAtivo: 'Imidacloprid', concentracao: '0,015%', tratamento: 'Sintomático' }
                ],
                'Desratização': [
                    { id: 'padrao_4', nome: 'Raticida Blocos', registroMs: 'N/A', grupoQuimico: 'Anticoagulante', principioAtivo: 'Brodifacoum', concentracao: '0,005%', tratamento: 'Iscas' },
                    { id: 'padrao_5', nome: 'Raticida Pó', registroMs: 'N/A', grupoQuimico: 'Anticoagulante', principioAtivo: 'Coumatetralyl', concentracao: '0,0375%', tratamento: 'Pó de contato' }
                ],
                'Descupinização': [
                    { id: 'padrao_6', nome: 'Cupinicida Líquido', registroMs: 'N/A', grupoQuimico: 'Inseticida', principioAtivo: 'Imidacloprid', concentracao: '2%', tratamento: 'Barreira líquida' },
                    { id: 'padrao_7', nome: 'Cupinicida Solvente', registroMs: 'N/A', grupoQuimico: 'Inseticida', principioAtivo: 'Fipronil', concentracao: '0,15%', tratamento: 'Barreira solvente' }
                ]
            };
            var tipoServico = servico.tipos && servico.tipos.length > 0 ? servico.tipos[0] : servico.tipo;
            produtos = produtosPadrao[tipoServico] || produtosPadrao['Desinsetização'];
        }
        
        if (!produtos || produtos.length === 0) {
            container.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">Nenhum produto encontrado para este serviço</div>';
            if (contador) contador.textContent = '0 selecionados';
            return;
        }
        
        // Renderiza os produtos
        var html = '';
        var selecionados = 0;
        
        produtos.forEach(function(p, index) {
            var checked = 'checked';
            selecionados++;
            
            html += `
                <div class="produto-check-item" style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-bottom:1px solid #f0f4f8;${index === produtos.length - 1 ? 'border-bottom:none;' : ''}">
                    <input type="checkbox" class="cert-produto-check" data-produto-index="${index}" ${checked} style="width:16px;height:16px;cursor:pointer;flex-shrink:0;">
                    <div style="flex:1;display:flex;flex-wrap:wrap;gap:4px 12px;font-size:0.85rem;">
                        <span style="font-weight:500;color:#0b2a3b;">${p.nome || 'Produto'}</span>
                        ${p.registroMs ? '<span style="color:#4d687a;">Reg. MS: ' + p.registroMs + '</span>' : ''}
                        ${p.grupoQuimico ? '<span style="color:#4d687a;">' + p.grupoQuimico + '</span>' : ''}
                        ${p.principioAtivo ? '<span style="color:#4d687a;">' + p.principioAtivo + '</span>' : ''}
                        ${p.concentracao ? '<span style="color:#4d687a;">' + p.concentracao + '</span>' : ''}
                    </div>
                    <div style="font-size:0.7rem;color:#999;">
                        ${p.tratamento || 'Aplicação'}
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        if (contador) contador.textContent = selecionados + ' selecionados';
        
        // Adiciona listeners aos checkboxes
        var checks = container.querySelectorAll('.cert-produto-check');
        for (var j = 0; j < checks.length; j++) {
            (function(cb) {
                cb.addEventListener('change', function() {
                    atualizarContadorProdutos();
                });
            })(checks[j]);
        }
        
    } catch (e) {
        console.warn('Erro ao carregar produtos do certificado:', e);
        var container = document.getElementById('certProdutosLista');
        if (container) {
            container.innerHTML = '<div style="text-align:center;color:#b13e3a;padding:10px;">Erro ao carregar produtos.</div>';
        }
    }
};

// =============================================
// ===== ABRIR NOVO CERTIFICADO =====
// =============================================
window.abrirNovoCertificado = function () {
    try {
        if (typeof DB === 'undefined') {
            console.warn('DB não disponível, aguardando...');
            setTimeout(function() {
                window.abrirNovoCertificado();
            }, 500);
            return;
        }

        var servicos = DB.getAll('servicos').filter(function(s) {
            return s.status === 'Concluído' || s.status === 'Concluida' || s.status === 'Concluída';
        });

        if (servicos.length === 0) {
            alert('Não há serviços concluídos disponíveis para gerar certificados.');
            return;
        }

        var servicosOptions = servicos.map(function(s) {
            var cliente = getCliente(s.clienteId);
            var clienteNome = cliente ? cliente.nome : 'Cliente #' + s.clienteId;
            var tiposDisplay = s.tipos && s.tipos.length > 0 ? s.tipos.join(' + ') : s.tipo;
            return '<option value="' + s.id + '">#' + String(s.id).padStart(3, '0') + ' - ' + tiposDisplay + ' - ' + clienteNome + ' (' + s.data + ')</option>';
        }).join('');

        abrirModal('Novo Certificado Técnico', `
            <div class="form-group">
                <label>Serviço Concluído *</label>
                <select id="modalCertServico" style="width:100%;padding:12px 16px;border:1px solid #dce4ec;border-radius:12px;font-size:0.95rem;outline:none;" onchange="atualizarTiposCertificado(); carregarProdutosCertificado();">
                    ${servicosOptions}
                </select>
                <small style="color:#4d687a;display:block;margin-top:4px;">Selecione um serviço concluído para gerar o certificado</small>
            </div>
            
            <div class="form-group" id="certTipoContainer">
                <label>Tipo de Certificado *</label>
                <select id="modalCertTipo" style="width:100%;padding:12px 16px;border:1px solid #dce4ec;border-radius:12px;font-size:0.95rem;outline:none;">
                    <option value="Desinsetização">Desinsetização</option>
                    <option value="Desratização">Desratização</option>
                    <option value="Descupinização">Descupinização</option>
                </select>
                <small style="color:#4d687a;display:block;margin-top:4px;">Selecione o tipo de serviço para o certificado</small>
            </div>

            <div id="certMultiTiposInfo" style="display:none;background:#f0f7fc;padding:12px 16px;border-radius:8px;margin:12px 0;border-left:4px solid #8e44ad;">
                <p style="margin:0;font-size:0.9rem;color:#0b2a3b;">
                    <i class="fas fa-info-circle" style="color:#8e44ad;"></i>
                    <strong>Múltiplos serviços encontrados:</strong>
                    <span id="certTiposLista" style="display:block;margin-top:4px;color:#4d687a;"></span>
                </p>
                <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn-secondary btn-sm" onclick="gerarCertificadosSeparados()" style="background:#8e44ad;color:white;border:none;padding:6px 16px;border-radius:6px;cursor:pointer;">
                        <i class="fas fa-copy"></i> Gerar Certificados Separados
                    </button>
                    <button class="btn-secondary btn-sm" onclick="gerarCertificadoUnico()" style="background:#1d7a6b;color:white;border:none;padding:6px 16px;border-radius:6px;cursor:pointer;">
                        <i class="fas fa-file"></i> Gerar Certificado Único
                    </button>
                </div>
            </div>

            <div id="certProdutosContainer" style="margin:12px 0;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <label style="font-weight:600;color:#0b2a3b;font-size:0.95rem;">
                        <i class="fas fa-boxes" style="color:#1d7a6b;"></i> Produtos Utilizados
                    </label>
                    <div style="display:flex;gap:8px;">
                        <button class="btn-secondary btn-sm" onclick="selecionarTodosProdutos()" style="padding:4px 12px;font-size:0.75rem;">Selecionar Todos</button>
                        <button class="btn-secondary btn-sm" onclick="deselecionarTodosProdutos()" style="padding:4px 12px;font-size:0.75rem;">Limpar</button>
                    </div>
                </div>
                <div id="certProdutosLista" style="background:#f8fbfd;border:1px solid #e8eff5;border-radius:8px;padding:12px;max-height:200px;overflow-y:auto;">
                    <div style="text-align:center;color:#999;padding:20px;">
                        <i class="fas fa-spinner fa-spin"></i> Carregando produtos...
                    </div>
                </div>
                <small style="color:#4d687a;display:block;margin-top:4px;">
                    💡 Selecione os produtos que foram utilizados neste serviço.
                    <span id="produtosSelecionadosContador" style="font-weight:600;color:#1d7a6b;">0 selecionados</span>
                </small>
            </div>

            <div style="background:#f0f7fc;padding:12px 16px;border-radius:8px;margin:12px 0;border-left:4px solid #1d7a6b;">
                <p style="margin:0;font-size:0.9rem;color:#0b2a3b;">
                    <i class="fas fa-info-circle" style="color:#1d7a6b;"></i>
                    O certificado será gerado com base nos dados do serviço selecionado,
                    incluindo apenas os produtos selecionados acima, métodos empregados e observações.
                    <br><small style="color:#4d687a;">Para serviços com múltiplos tipos, você pode gerar certificados separados.</small>
                </p>
            </div>

            <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:12px;margin-top:24px;padding-top:20px;border-top:1px solid #e8eff5;">
                <button class="btn-secondary" onclick="fecharModal()" style="background:#e8eff5;color:#1f3a4b;border:none;padding:12px 28px;border-radius:40px;font-weight:600;cursor:pointer;transition:0.2s;">Cancelar</button>
                <button class="btn-primary" onclick="criarCertificadoComProdutos()" style="background:#0b2a3b;color:white;border:none;padding:12px 28px;border-radius:40px;font-weight:600;cursor:pointer;transition:0.2s;display:inline-flex;align-items:center;gap:10px;box-shadow:0 4px 10px rgba(11,42,59,0.2);">
                    <i class="fas fa-certificate"></i> Gerar Certificado
                </button>
            </div>
        `);

        // O TIMEOUT É CRUCIAL PARA GARANTIR QUE OS ELEMENTOS ESTEJAM NO DOM
        setTimeout(function() {
            try {
                if (typeof window.atualizarTiposCertificado === 'function') {
                    window.atualizarTiposCertificado();
                }
                if (typeof window.carregarProdutosCertificado === 'function') {
                    window.carregarProdutosCertificado();
                }
            } catch (e) {
                console.warn('Erro ao atualizar certificado:', e);
            }
        }, 500);
    } catch (e) {
        console.warn('Erro ao abrir novo certificado:', e);
        alert('Erro ao abrir o formulário de certificado. Tente novamente.');
    }
};

// =============================================
// ===== FUNÇÕES AUXILIARES DO CERTIFICADO =====
// =============================================

window.atualizarTiposCertificado = function() {
    try {
        if (typeof DB === 'undefined') {
            console.warn('DB não disponível em atualizarTiposCertificado');
            return;
        }

        var servicoId = parseInt(document.getElementById('modalCertServico')?.value || '0');
        var tipoSelect = document.getElementById('modalCertTipo');
        var multiInfo = document.getElementById('certMultiTiposInfo');
        var tiposLista = document.getElementById('certTiposLista');
        
        if (!servicoId || !tipoSelect) return;
        
        var servico = DB.getById('servicos', servicoId);
        if (!servico) {
            console.warn('Serviço não encontrado:', servicoId);
            return;
        }
        
        var tipos = servico.tipos || [servico.tipo];
        
        if (tipos.length > 1) {
            if (multiInfo) multiInfo.style.display = 'block';
            if (tiposLista) tiposLista.textContent = tipos.join(' + ');
            
            var currentValue = tipoSelect.value;
            tipoSelect.innerHTML = tipos.map(function(t) {
                return '<option value="' + t + '" ' + (t === currentValue ? 'selected' : '') + '>' + t + '</option>';
            }).join('');
        } else {
            if (multiInfo) multiInfo.style.display = 'none';
            tipoSelect.innerHTML = '<option value="' + tipos[0] + '">' + tipos[0] + '</option>';
        }
    } catch (e) {
        console.warn('Erro ao atualizar tipos do certificado:', e);
    }
};

function atualizarContadorProdutos() {
    try {
        var checks = document.querySelectorAll('.cert-produto-check');
        var selecionados = 0;
        for (var i = 0; i < checks.length; i++) {
            if (checks[i].checked) selecionados++;
        }
        var contador = document.getElementById('produtosSelecionadosContador');
        if (contador) {
            contador.textContent = selecionados + ' selecionados';
        }
    } catch (e) {
        console.warn('Erro ao atualizar contador:', e);
    }
}

window.selecionarTodosProdutos = function() {
    try {
        var checks = document.querySelectorAll('.cert-produto-check');
        for (var i = 0; i < checks.length; i++) {
            checks[i].checked = true;
        }
        atualizarContadorProdutos();
    } catch (e) {
        console.warn('Erro ao selecionar todos os produtos:', e);
    }
};

window.deselecionarTodosProdutos = function() {
    try {
        var checks = document.querySelectorAll('.cert-produto-check');
        for (var i = 0; i < checks.length; i++) {
            checks[i].checked = false;
        }
        atualizarContadorProdutos();
    } catch (e) {
        console.warn('Erro ao deselecionar todos os produtos:', e);
    }
};

window.criarCertificadoComProdutos = function() {
    try {
        if (typeof DB === 'undefined') {
            alert('Sistema não disponível. Tente novamente.');
            return;
        }

        var servicoId = parseInt(document.getElementById('modalCertServico')?.value || '0');
        var tipo = document.getElementById('modalCertTipo')?.value || 'Desinsetização';

        if (!servicoId) {
            alert('Selecione um serviço!');
            return;
        }

        var produtoChecks = document.querySelectorAll('.cert-produto-check:checked');
        if (produtoChecks.length === 0) {
            alert('Selecione pelo menos um produto para incluir no certificado!');
            return;
        }

        var servico = DB.getById('servicos', servicoId);
        if (!servico) {
            alert('Serviço não encontrado!');
            return;
        }

        var ordens = DB.getAll('ordens');
        var osVinculada = null;
        for (var i = 0; i < ordens.length; i++) {
            if (ordens[i].servicoId === servico.id) {
                osVinculada = ordens[i];
                break;
            }
        }
        
        var produtosCompletos = [];
        
        for (var j = 0; j < produtoChecks.length; j++) {
            var index = parseInt(produtoChecks[j].dataset.produtoIndex);
            var produtoCompleto = null;
            
            if (osVinculada && osVinculada.inseticidasUtilizados && osVinculada.inseticidasUtilizados.length > index) {
                var ins = osVinculada.inseticidasUtilizados[index];
                produtoCompleto = {
                    nome: ins.nome || '',
                    registroMs: ins.registro || ins.registroMs || '',
                    grupoQuimico: ins.gQuimico || ins.grupoQuimico || '',
                    principioAtivo: ins.pAtivo || ins.principioAtivo || '',
                    concentracao: ins.porcentagem || ins.concentracao || '',
                    tratamento: ins.tratamento || 'Sintomático',
                    quantidade: ins.quantidade || 1,
                    unidade: ins.unidade || ''
                };
            } else {
                var servicoProdutos = servico.produtosUtilizados || [];
                if (servicoProdutos.length > index) {
                    var sp = servicoProdutos[index];
                    produtoCompleto = {
                        nome: sp.nome || '',
                        registroMs: sp.registroMs || sp.registro || '',
                        grupoQuimico: sp.grupoQuimico || sp.gQuimico || '',
                        principioAtivo: sp.principioAtivo || sp.pAtivo || '',
                        concentracao: sp.concentracao || sp.porcentagem || '',
                        tratamento: sp.tratamento || 'Sintomático',
                        quantidade: sp.quantidade || 1,
                        unidade: sp.unidade || ''
                    };
                }
            }
            
            if (produtoCompleto) {
                produtosCompletos.push(produtoCompleto);
            }
        }

        if (produtosCompletos.length === 0) {
            var servicoTipos = servico.tipos || [servico.tipo];
            var tipoPrincipal = servicoTipos[0] || tipo;
            
            var produtosPadrao = {
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
            
            var listaCompleta = produtosPadrao[tipoPrincipal] || [];
            for (var k = 0; k < produtoChecks.length; k++) {
                var idx = parseInt(produtoChecks[k].dataset.produtoIndex);
                if (listaCompleta[idx]) {
                    produtosCompletos.push(listaCompleta[idx]);
                }
            }
        }

        var certificado = CertificadoService.gerarCertificadoComProdutos(servicoId, tipo, produtosCompletos);
        
        fecharModal();

        renderCertificados();
        preencherFiltroCertificados();

        if (typeof renderAll === 'function') {
            renderAll();
        }

        setTimeout(function () {
            var card = document.getElementById('certificado-card-' + certificado.id);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.style.transition = 'all 0.5s ease';
                card.style.boxShadow = '0 0 0 3px #1d7a6b, 0 8px 30px rgba(29,122,107,0.3)';
                setTimeout(function () {
                    card.style.boxShadow = '';
                }, 3000);
            } else {
                renderCertificados();
            }
        }, 300);

        alert('✅ Certificado gerado com ' + produtosCompletos.length + ' produto(s)!');

        if (confirm('Deseja visualizar o certificado agora?')) {
            visualizarCertificado(certificado.id);
        }
    } catch (error) {
        alert('Erro ao gerar certificado: ' + error.message);
        console.error(error);
    }
};

// =============================================
// ===== GERAR CERTIFICADOS SEPARADOS E ÚNICO =====
// =============================================

window.gerarCertificadosSeparados = function() {
    try {
        if (typeof DB === 'undefined') {
            alert('Sistema não disponível. Tente novamente.');
            return;
        }

        var servicoId = parseInt(document.getElementById('modalCertServico')?.value || '0');
        if (!servicoId) {
            alert('Selecione um serviço!');
            return;
        }
        
        var servico = DB.getById('servicos', servicoId);
        if (!servico) {
            alert('Serviço não encontrado!');
            return;
        }
        
        var tipos = servico.tipos || [servico.tipo];
        
        if (tipos.length < 2) {
            alert('Este serviço possui apenas um tipo. Use a opção "Gerar Certificado".');
            return;
        }
        
        if (!confirm('Deseja gerar ' + tipos.length + ' certificados separados para os serviços: ' + tipos.join(' + ') + '?')) {
            return;
        }
        
        var certificadosGerados = [];
        var erros = [];
        
        tipos.forEach(function(tipo) {
            try {
                var certificado = CertificadoService.gerarCertificado(servicoId, tipo);
                certificadosGerados.push(certificado);
            } catch (error) {
                erros.push(tipo + ': ' + error.message);
                console.warn('❌ Erro ao gerar certificado para ' + tipo + ':', error);
            }
        });
        
        fecharModal();
        
        if (certificadosGerados.length > 0) {
            renderCertificados();
            preencherFiltroCertificados();
            
            if (typeof renderAll === 'function') {
                renderAll();
            }
            
            alert('✅ ' + certificadosGerados.length + ' certificados gerados com sucesso!' + (erros.length > 0 ? '\n\n⚠️ Erros: ' + erros.join('\n') : ''));
            
            if (certificadosGerados.length === 1) {
                if (confirm('Deseja visualizar o certificado gerado?')) {
                    visualizarCertificado(certificadosGerados[0].id);
                }
            }
        } else {
            alert('❌ Nenhum certificado foi gerado. Verifique os erros.');
        }
    } catch (e) {
        console.warn('Erro ao gerar certificados separados:', e);
        alert('Erro ao gerar certificados: ' + e.message);
    }
};

window.gerarCertificadoUnico = function() {
    try {
        if (typeof DB === 'undefined') {
            alert('Sistema não disponível. Tente novamente.');
            return;
        }

        var servicoId = parseInt(document.getElementById('modalCertServico')?.value || '0');
        if (!servicoId) {
            alert('Selecione um serviço!');
            return;
        }
        
        var servico = DB.getById('servicos', servicoId);
        if (!servico) {
            alert('Serviço não encontrado!');
            return;
        }
        
        var tipos = servico.tipos || [servico.tipo];
        var tipoSelecionado = document.getElementById('modalCertTipo')?.value || tipos[0];
        
        var certificado = CertificadoService.gerarCertificadoCombinado(servicoId, tipoSelecionado, tipos);
        
        fecharModal();
        renderCertificados();
        preencherFiltroCertificados();
        
        if (typeof renderAll === 'function') {
            renderAll();
        }
        
        alert('✅ Certificado único gerado com sucesso para: ' + tipos.join(' + '));
        
        if (confirm('Deseja visualizar o certificado gerado?')) {
            visualizarCertificado(certificado.id);
        }
    } catch (error) {
        alert('Erro ao gerar certificado: ' + error.message);
        console.error(error);
    }
};

    // =============================================
    // ===== SERVIÇO DE ASSINATURAS SALVAS =====
    // =============================================

    const AssinaturaService = {
        salvarAssinaturaMembro: function (membroId, tipo, imagemData) {
            if (!membroId) return false;

            const equipe = DB.getAll('equipe');
            const membro = equipe.find(m => String(m.id) === String(membroId));
            if (!membro) return false;

            const campo = tipo === 'tecnico' ? 'assinaturaTecnico' : 'assinaturaOperacional';

            DB.update('equipe', membroId, {
                [campo]: imagemData,
                assinaturaAtualizada: new Date().toISOString()
            });

            DB.forceClearCache('equipe');

            return true;
        },

        getAssinaturaMembro: function (membroId, tipo) {
            if (!membroId) return null;

            const equipe = DB.getAll('equipe');
            const membro = equipe.find(m => String(m.id) === String(membroId));
            if (!membro) return null;

            const campo = tipo === 'tecnico' ? 'assinaturaTecnico' : 'assinaturaOperacional';
            return membro[campo] || null;
        },

        temAssinaturaSalva: function (membroId, tipo) {
            return this.getAssinaturaMembro(membroId, tipo) !== null;
        },

        aplicarAssinaturaSalva: function (certId, tipo, membroId) {
            if (!membroId) {
                alert('Selecione um responsável primeiro!');
                return false;
            }

            const imagemData = this.getAssinaturaMembro(membroId, tipo);
            if (!imagemData) {
                alert('Este responsável não possui uma assinatura salva. Você pode adicionar uma clicando no botão "Gerenciar Assinaturas".');
                return false;
            }

            const campo = tipo === 'tecnico' ? 'assinaturaTecnico' : 'assinaturaOperacional';

            DB.update('certificados', certId, {
                [campo]: imagemData
            });

            setTimeout(() => {
                visualizarCertificado(certId);
            }, 100);

            document.dispatchEvent(new CustomEvent('certificadoAtualizado', {
                detail: { certificado: { id: certId }, action: 'update' }
            }));

            return true;
        }
    };

    window.AssinaturaService = AssinaturaService;

    // =============================================
    // ===== FUNÇÕES DE GERENCIAMENTO DE ASSINATURAS =====
    // =============================================

    window.abrirGerenciadorAssinaturas = function () {
        const equipe = DB.getAll('equipe');

        if (equipe.length === 0) {
            alert('Cadastre membros na equipe primeiro!');
            return;
        }

        const html = `
            <div style="margin-bottom:16px;">
                <p style="color:#4d687a;font-size:0.9rem;">
                    <i class="fas fa-info-circle" style="color:#1d7a6b;"></i>
                    Gerencie as assinaturas salvas dos membros da equipe. 
                    As assinaturas serão aplicadas automaticamente nos certificados.
                </p>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-height:500px;overflow-y:auto;">
                ${equipe.map(m => `
                    <div style="background:#f8fbfd;border-radius:12px;padding:16px;border:1px solid #e8eff5;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <div>
                                <strong style="color:#0b2a3b;">${m.nome}</strong>
                                <span style="display:block;font-size:0.8rem;color:#4d687a;">${m.cargo || 'Sem cargo'}</span>
                            </div>
                            <span style="font-size:0.7rem;color:#999;">ID: ${m.id}</span>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
                            <div style="background:white;border-radius:8px;padding:8px;border:1px solid #e8eff5;text-align:center;">
                                <div style="font-size:0.7rem;font-weight:600;color:#0b2a3b;margin-bottom:4px;">Assinatura Técnico</div>
                                ${m.assinaturaTecnico ?
                `<img src="${m.assinaturaTecnico}" style="max-width:100%;max-height:50px;border:1px solid #e8eff5;border-radius:4px;margin:4px 0;" />` :
                '<span style="font-size:0.7rem;color:#999;">Não definida</span>'
            }
                                <div style="margin-top:4px;display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">
                                    <button onclick="abrirUploadAssinatura(${m.id}, 'tecnico')" style="background:#0b2a3b;color:white;border:none;padding:2px 10px;border-radius:4px;font-size:0.7rem;cursor:pointer;">
                                        ${m.assinaturaTecnico ? '🔄' : '📤'} ${m.assinaturaTecnico ? 'Trocar' : 'Upload'}
                                    </button>
                                    ${m.assinaturaTecnico ? `<button onclick="removerAssinaturaMembro(${m.id}, 'tecnico')" style="background:#b13e3a;color:white;border:none;padding:2px 10px;border-radius:4px;font-size:0.7rem;cursor:pointer;">🗑️</button>` : ''}
                                </div>
                            </div>
                            <div style="background:white;border-radius:8px;padding:8px;border:1px solid #e8eff5;text-align:center;">
                                <div style="font-size:0.7rem;font-weight:600;color:#0b2a3b;margin-bottom:4px;">Assinatura Operacional</div>
                                ${m.assinaturaOperacional ?
                `<img src="${m.assinaturaOperacional}" style="max-width:100%;max-height:50px;border:1px solid #e8eff5;border-radius:4px;margin:4px 0;" />` :
                '<span style="font-size:0.7rem;color:#999;">Não definida</span>'
            }
                                <div style="margin-top:4px;display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">
                                    <button onclick="abrirUploadAssinatura(${m.id}, 'operacional')" style="background:#0b2a3b;color:white;border:none;padding:2px 10px;border-radius:4px;font-size:0.7rem;cursor:pointer;">
                                        ${m.assinaturaOperacional ? '🔄' : '📤'} ${m.assinaturaOperacional ? 'Trocar' : 'Upload'}
                                    </button>
                                    ${m.assinaturaOperacional ? `<button onclick="removerAssinaturaMembro(${m.id}, 'operacional')" style="background:#b13e3a;color:white;border:none;padding:2px 10px;border-radius:4px;font-size:0.7rem;cursor:pointer;">🗑️</button>` : ''}
                                </div>
                            </div>
                        </div>
                        ${(m.assinaturaTecnico || m.assinaturaOperacional) ? `
                            <div style="margin-top:8px;font-size:0.6rem;color:#999;text-align:center;">
                                Atualizado: ${m.assinaturaAtualizada ? new Date(m.assinaturaAtualizada).toLocaleString('pt-BR') : 'N/A'}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
            <div class="modal-footer" style="margin-top:16px;">
                <button class="btn-secondary" onclick="fecharModal()">Fechar</button>
                <button class="btn-primary" onclick="fecharModal()" style="background:#1d7a6b;">
                    <i class="fas fa-check"></i> Concluído
                </button>
            </div>
        `;

        abrirModal('📝 Gerenciar Assinaturas da Equipe', html);
    };

    window.abrirUploadAssinatura = function (membroId, tipo) {
        const equipe = DB.getAll('equipe');
        const membro = equipe.find(m => String(m.id) === String(membroId));
        if (!membro) {
            alert('Membro não encontrado!');
            return;
        }

        const tipoLabel = tipo === 'tecnico' ? 'Técnico' : 'Operacional';
        const hasExisting = tipo === 'tecnico' ? membro.assinaturaTecnico : membro.assinaturaOperacional;

        abrirModal(`📤 Upload Assinatura - ${membro.nome} (${tipoLabel})`, `
            <div style="text-align:center;padding:8px 0;">
                <div style="font-size:3rem;">✍️</div>
                <p style="color:#4d687a;font-size:0.9rem;">
                    Faça upload de uma imagem da assinatura do <strong>${tipoLabel}</strong>.
                </p>
                <p style="color:#999;font-size:0.8rem;">
                    Formatos aceitos: PNG, JPG, JPEG, SVG
                </p>
            </div>
            
            ${hasExisting ? `
                <div style="background:#f0f7fc;padding:12px;border-radius:8px;margin-bottom:12px;text-align:center;border-left:4px solid #1d7a6b;">
                    <div style="font-size:0.8rem;color:#4d687a;">Assinatura atual:</div>
                    <img src="${hasExisting}" style="max-width:200px;max-height:60px;border:1px solid #e8eff5;border-radius:4px;margin:4px auto;" />
                </div>
            ` : ''}
            
            <div class="form-group">
                <label>Selecione a imagem da assinatura</label>
                <input type="file" id="uploadAssinaturaInput" accept="image/*" style="padding:8px;" />
                <div id="uploadAssinaturaPreview" style="margin-top:8px;text-align:center;"></div>
            </div>
            
            <div style="background:#f0f7fc;padding:12px;border-radius:8px;margin:8px 0;border-left:4px solid #1d7a6b;">
                <p style="margin:0;font-size:0.85rem;color:#0b2a3b;">
                    <i class="fas fa-lightbulb" style="color:#e67e22;"></i>
                    <strong>Dica:</strong> Use uma imagem com fundo branco ou transparente para melhor resultado.
                    Recorte apenas a área da assinatura para ficar mais profissional.
                </p>
            </div>
            
            <div class="modal-footer">
                <button class="btn-secondary" onclick="fecharModal()">Cancelar</button>
                <button class="btn-primary" onclick="salvarUploadAssinatura(${membroId}, '${tipo}')">
                    <i class="fas fa-save"></i> Salvar Assinatura
                </button>
            </div>
        `);

        setTimeout(() => {
            const input = document.getElementById('uploadAssinaturaInput');
            if (input) {
                input.addEventListener('change', function (e) {
                    const preview = document.getElementById('uploadAssinaturaPreview');
                    if (!preview) return;

                    const file = this.files[0];
                    if (!file) {
                        preview.innerHTML = '';
                        return;
                    }

                    const reader = new FileReader();
                    reader.onload = function (e) {
                        preview.innerHTML = `
                            <div style="display:inline-block;border:2px solid #1d7a6b;border-radius:8px;padding:8px;background:white;">
                                <img src="${e.target.result}" style="max-width:200px;max-height:80px;object-fit:contain;" />
                                <div style="font-size:0.7rem;color:#999;margin-top:4px;">${file.name} (${(file.size / 1024).toFixed(1)} KB)</div>
                            </div>
                        `;
                    };
                    reader.readAsDataURL(file);
                });
            }
        }, 100);
    };

    window.salvarUploadAssinatura = function (membroId, tipo) {
        const input = document.getElementById('uploadAssinaturaInput');
        if (!input || !input.files || !input.files[0]) {
            alert('Selecione uma imagem da assinatura!');
            return;
        }

        const file = input.files[0];
        const reader = new FileReader();

        reader.onload = function (e) {
            const imagemData = e.target.result;

            const result = AssinaturaService.salvarAssinaturaMembro(membroId, tipo, imagemData);

            if (result) {
                fecharModal();

                setTimeout(() => {
                    abrirGerenciadorAssinaturas();
                }, 200);

                alert('✅ Assinatura salva com sucesso!');
            } else {
                alert('❌ Erro ao salvar assinatura.');
            }
        };

        reader.readAsDataURL(file);
    };

    window.removerAssinaturaMembro = function (membroId, tipo) {
        if (!confirm('Tem certeza que deseja remover esta assinatura?')) {
            return;
        }

        const campo = tipo === 'tecnico' ? 'assinaturaTecnico' : 'assinaturaOperacional';
        const updateData = {};
        updateData[campo] = null;

        DB.update('equipe', membroId, updateData);
        DB.forceClearCache('equipe');

        setTimeout(() => {
            abrirGerenciadorAssinaturas();
        }, 100);

        alert('Assinatura removida com sucesso!');
    };

    window.aplicarAssinaturaSalvaCertificado = function (certId, tipo) {
        const certificado = CertificadoService.getCertificado(certId);
        if (!certificado) {
            alert('Certificado não encontrado!');
            return;
        }

        const campo = tipo === 'tecnico' ? 'tecnico' : 'operacional';
        const responsavel = certificado.responsaveis?.[campo];

        if (!responsavel || !responsavel.id || responsavel.id === 'default_tecnico' || responsavel.id === 'default_operacional') {
            alert('Selecione um responsável válido no certificado primeiro!');
            return;
        }

        const imagemData = AssinaturaService.getAssinaturaMembro(responsavel.id, tipo);
        if (!imagemData) {
            if (confirm(`O responsável "${responsavel.nome}" não possui uma assinatura salva. Deseja abrir o gerenciador para adicionar uma?`)) {
                abrirGerenciadorAssinaturas();
            }
            return;
        }

        const campoAssinatura = tipo === 'tecnico' ? 'assinaturaTecnico' : 'assinaturaOperacional';
        DB.update('certificados', certId, {
            [campoAssinatura]: imagemData
        });

        setTimeout(() => {
            visualizarCertificado(certId);
        }, 100);

        document.dispatchEvent(new CustomEvent('certificadoAtualizado', {
            detail: { certificado: { id: certId }, action: 'update' }
        }));

        alert('✅ Assinatura aplicada ao certificado com sucesso!');
    };

    // =============================================
    // ===== FUNÇÕES AUXILIARES DO CERTIFICADO =====
    // =============================================

    window.handleObservacaoEnter = function (event, certId) {
        if (event.key === 'Enter') {
            event.preventDefault();
            document.execCommand('insertLineBreak');
        }
    };

    window.salvarObservacaoCertificado = function (certId, conteudo) {
        const texto = conteudo
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<div>/gi, '\n')
            .replace(/<\/div>/gi, '')
            .replace(/<p>/gi, '')
            .replace(/<\/p>/gi, '\n')
            .replace(/&nbsp;/g, ' ')
            .trim();

        if (texto !== '') {
            DB.update('certificados', certId, { observacoes: texto });
        }
    };

    window.atualizarResponsavelCertificado = function (certId, tipo, membroId) {

        if (!membroId || membroId === '' || membroId === 'default_tecnico' || membroId === 'default_operacional') {
            console.warn('⚠️ Nenhum membro selecionado - resetando');
            const infoEl = document.getElementById('cert' + (tipo === 'tecnico' ? 'Tecnico' : 'Operacional') + 'Info_' + certId);
            if (infoEl) {
                infoEl.textContent = 'Nenhum ' + (tipo === 'tecnico' ? 'técnico' : 'operacional') + ' selecionado';
            }

            const updateData = {};
            const campo = tipo === 'tecnico' ? 'tecnico' : 'operacional';
            updateData['responsaveis.' + campo] = {
                id: null,
                nome: 'Selecione...',
                registro: '',
                atuacao: ''
            };
            DB.update('certificados', certId, updateData);

            setTimeout(function () {
                visualizarCertificado(certId);
            }, 150);
            return;
        }

        const equipe = DB.getAll('equipe');
        const membro = equipe.find(function (m) {
            return String(m.id) === String(membroId);
        });

        if (!membro) {
            console.warn('⚠️ Membro não encontrado:', membroId);
            const membroByName = equipe.find(function (m) {
                return m.nome && m.nome.toLowerCase() === String(membroId).toLowerCase();
            });
            if (membroByName) {
                return window.atualizarResponsavelCertificado(certId, tipo, String(membroByName.id));
            }
            return;
        }


        const certificado = CertificadoService.getCertificado(certId);
        if (!certificado) {
            console.warn('⚠️ Certificado não encontrado:', certId);
            return;
        }

        const updateData = {};
        const campo = tipo === 'tecnico' ? 'tecnico' : 'operacional';

        const responsavelData = {
            id: membro.id,
            nome: membro.nome,
            registro: membro.registro || '',
            atuacao: membro.cargo || ''
        };

        updateData['responsaveis.' + campo] = responsavelData;


        DB.update('certificados', certId, updateData);

        if (typeof FirestoreService !== 'undefined') {
            try {
                const certAtualizado = CertificadoService.getCertificado(certId);
                if (certAtualizado) {
                    FirestoreService.update('certificados', certId, certAtualizado).catch(err => {
                        console.warn('⚠️ Erro na sincronização Firestore:', err);
                    });
                }
            } catch (e) {
                console.warn('⚠️ Erro na sincronização Firestore:', e);
            }
        }

        const infoEl = document.getElementById('cert' + (tipo === 'tecnico' ? 'Tecnico' : 'Operacional') + 'Info_' + certId);
        if (infoEl) {
            infoEl.textContent = membro.nome + (membro.registro ? ' - ' + membro.registro : '');
        }

        const selectEl = document.getElementById('cert' + (tipo === 'tecnico' ? 'Tecnico' : 'Operacional') + 'Select_' + certId);
        if (selectEl) {
            selectEl.value = membroId;
        }

        setTimeout(function () {
            const certVerificado = CertificadoService.getCertificado(certId);
            if (certVerificado) {
                const responsavelSalvo = certVerificado.responsaveis?.[campo];
                if (responsavelSalvo && String(responsavelSalvo.id) === String(membro.id)) {
                } else {
                    console.warn('⚠️ Responsável não foi salvo corretamente, forçando re-salvamento...');
                    DB.update('certificados', certId, updateData);
                }
            }
            renderCertificados();
        }, 300);
    };

    window.editarObservacaoCertificado = function (certId) {
        const certificado = CertificadoService.getCertificado(certId);
        if (!certificado) return;

        const novaObs = prompt('Edite as observações do certificado:', certificado.observacoes || '');
        if (novaObs !== null) {
            DB.update('certificados', certId, { observacoes: novaObs });
            setTimeout(function () {
                visualizarCertificado(certId);
            }, 100);
        }
    };

    window.abrirAssinaturaCertificado = function (certId, tipo) {
        const certificado = CertificadoService.getCertificado(certId);
        if (!certificado) return;

        abrirModal('Assinatura Digital - ' + (tipo === 'tecnico' ? 'Responsável Técnico' : 'Responsável Operacional'), `
            <div style="text-align:center;margin-bottom:12px;">
                <p style="font-size:0.9rem;color:#4d687a;">Desenhe sua assinatura abaixo</p>
            </div>
            <div style="border:2px solid #dce4ec;border-radius:8px;overflow:hidden;background:white;margin:0 auto;max-width:400px;">
                <canvas id="sigCanvasCert" width="400" height="160" style="width:100%;height:auto;cursor:crosshair;touch-action:none;"></canvas>
            </div>
            <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
                <button class="btn-secondary btn-sm" onclick="limparAssinaturaCert()"><i class="fas fa-eraser"></i> Limpar</button>
                <button class="btn-primary btn-sm" onclick="confirmarAssinaturaCert('${certId}', '${tipo}')"><i class="fas fa-check"></i> Confirmar</button>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="fecharModal()">Cancelar</button>
            </div>
        `);

        setTimeout(function () {
            const targetCanvas = document.getElementById('sigCanvasCert');
            if (targetCanvas) {
                const targetCtx = targetCanvas.getContext('2d');
                targetCtx.fillStyle = 'white';
                targetCtx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
                targetCtx.strokeStyle = '#ccc';
                targetCtx.lineWidth = 1;
                targetCtx.setLineDash([5, 5]);
                targetCtx.moveTo(40, 80);
                targetCtx.lineTo(targetCanvas.width - 40, 80);
                targetCtx.stroke();
                targetCtx.setLineDash([]);

                let drawing = false;
                let lastX = 0, lastY = 0;

                targetCanvas.addEventListener('mousedown', function (e) {
                    drawing = true;
                    const rect = targetCanvas.getBoundingClientRect();
                    lastX = (e.clientX - rect.left) * (targetCanvas.width / rect.width);
                    lastY = (e.clientY - rect.top) * (targetCanvas.height / rect.height);
                });

                targetCanvas.addEventListener('mousemove', function (e) {
                    if (!drawing) return;
                    const rect = targetCanvas.getBoundingClientRect();
                    const x = (e.clientX - rect.left) * (targetCanvas.width / rect.width);
                    const y = (e.clientY - rect.top) * (targetCanvas.height / rect.height);
                    targetCtx.beginPath();
                    targetCtx.moveTo(lastX, lastY);
                    targetCtx.lineTo(x, y);
                    targetCtx.strokeStyle = '#0b2a3b';
                    targetCtx.lineWidth = 2;
                    targetCtx.stroke();
                    lastX = x;
                    lastY = y;
                });

                targetCanvas.addEventListener('mouseup', function () { drawing = false; });
                targetCanvas.addEventListener('mouseleave', function () { drawing = false; });

                targetCanvas.addEventListener('touchstart', function (e) {
                    e.preventDefault();
                    const touch = e.touches[0];
                    const rect = targetCanvas.getBoundingClientRect();
                    lastX = (touch.clientX - rect.left) * (targetCanvas.width / rect.width);
                    lastY = (touch.clientY - rect.top) * (targetCanvas.height / rect.height);
                    drawing = true;
                });

                targetCanvas.addEventListener('touchmove', function (e) {
                    e.preventDefault();
                    if (!drawing) return;
                    const touch = e.touches[0];
                    const rect = targetCanvas.getBoundingClientRect();
                    const x = (touch.clientX - rect.left) * (targetCanvas.width / rect.width);
                    const y = (touch.clientY - rect.top) * (targetCanvas.height / rect.height);
                    targetCtx.beginPath();
                    targetCtx.moveTo(lastX, lastY);
                    targetCtx.lineTo(x, y);
                    targetCtx.strokeStyle = '#0b2a3b';
                    targetCtx.lineWidth = 2;
                    targetCtx.stroke();
                    lastX = x;
                    lastY = y;
                });

                targetCanvas.addEventListener('touchend', function (e) {
                    e.preventDefault();
                    drawing = false;
                });
            }
        }, 100);
    };

    window.limparAssinaturaCert = function () {
        const canvas = document.getElementById('sigCanvasCert');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.moveTo(40, 80);
        ctx.lineTo(canvas.width - 40, 80);
        ctx.stroke();
        ctx.setLineDash([]);
    };

    window.confirmarAssinaturaCert = function (certId, tipo) {
        const canvas = document.getElementById('sigCanvasCert');
        if (!canvas) return;

        const imageData = canvas.toDataURL('image/png');
        const img = new Image();
        img.onload = function () {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(img, 0, 0);

            const pixelData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
            let hasDrawing = false;
            for (let i = 0; i < pixelData.length; i += 4) {
                const r = pixelData[i];
                const g = pixelData[i + 1];
                const b = pixelData[i + 2];
                if (r < 240 || g < 240 || b < 240) {
                    hasDrawing = true;
                    break;
                }
            }

            if (!hasDrawing) {
                alert('Por favor, desenhe a assinatura antes de confirmar!');
                return;
            }

            const campo = tipo === 'tecnico' ? 'assinaturaTecnico' : 'assinaturaOperacional';
            DB.update('certificados', certId, { [campo]: imageData });

            fecharModal();
            setTimeout(function () {
                visualizarCertificado(certId);
            }, 100);
            alert('Assinatura salva com sucesso!');
        };
        img.src = imageData;
    };

    // =============================================
    // ===== CONTROLE DE RENDERIZAÇÃO =====
    // =============================================
    var _renderTimeout = null;
    var _isRendering = false;

    function renderAll() {
        if (_isRendering) {
            if (_renderTimeout) clearTimeout(_renderTimeout);
            _renderTimeout = setTimeout(function () {
                _renderTimeout = null;
                renderAll();
            }, 100);
            return;
        }

        _isRendering = true;

        try {
            renderDashboard();
            renderOrdens();
            renderMapaIscas();
            renderServicos();
            renderOrcamentos();
            renderClientes();
            renderAgenda();
            renderEquipe();
            renderRelatorios();
            carregarConfiguracoes();
            renderEstoque();
            renderMovimentacoes();
            renderHistorico();
            atualizarGraficosEstoque();
            atualizarDashboardEstoque();
            preencherFiltrosClientes();
            preencherFiltrosOrcamentos();
            renderFinanceiro();
            renderCertificados();
            preencherFiltroCertificados();
            adicionarIndicadorPlano();
            carregarInfoAdministracao();
        } catch (error) {
            console.error('❌ Erro na renderização:', error);
        } finally {
            _isRendering = false;
            if (_renderTimeout) {
                clearTimeout(_renderTimeout);
                _renderTimeout = null;
            }
        }
    }

    window.resetarDados = function () {
        if (confirm('ATENÇÃO: Isso irá apagar TODOS os dados do sistema (clientes, serviços, OS, estoque, etc.)!\n\nTem certeza?')) {
            if (confirm('Última confirmação: Esta ação é IRREVERSÍVEL.')) {
                if (typeof FirestoreService !== 'undefined') {
                    FirestoreService.pararObservadores();
                }

                DB.limparDados();

                if (typeof FirestoreService !== 'undefined' && typeof db !== 'undefined') {
                    var empresaId = EmpresaManager.getEmpresaAtual();
                    var collections = ['clientes', 'servicos', 'ordens', 'agenda', 'equipe',
                        'pontosIscas', 'relatorios', 'modelos', 'estoque',
                        'movimentacoes', 'orcamentos', 'configuracoes', 'certificados'];

                    collections.forEach(function (col) {
                        db.collection(col).where('empresaId', '==', empresaId).get().then(function (snapshot) {
                            if (snapshot.size > 0) {
                                var batch = db.batch();
                                snapshot.forEach(function (doc) {
                                    batch.delete(doc.ref);
                                });
                                batch.commit().catch(function (e) {
                                    console.warn('Erro ao deletar ' + col + ':', e);
                                });
                            }
                        }).catch(function (e) {
                            console.warn('Erro ao buscar ' + col + ':', e);
                        });
                    });
                }

                renderAll();
                alert('✅ Todos os dados foram resetados! O sistema está completamente limpo.');
            }
        }
    };

    window.forcarSincronizacao = function () {
        if (typeof DB !== 'undefined' && DB.forcarSincronizacao) {
            DB.forcarSincronizacao().then(function (total) {
                alert('✅ Dados sincronizados com o servidor! ' + total + ' itens atualizados.');
            }).catch(function (err) {
                console.error('❌ Erro na sincronização:', err);
                alert('❌ Erro ao sincronizar dados. Verifique sua conexão.\n\nErro: ' + err);
            });
        } else {
            alert('⚠️ Serviço de sincronização não disponível.');
        }
    };

    window.forcarCarregamentoFirestore = function () {
        if (typeof FirestoreService !== 'undefined') {
            var empresaId = EmpresaManager.getEmpresaAtual();

            if (typeof DB !== 'undefined') {
                DB._clearAllCaches();
            }

            FirestoreService.sincronizarDadosEmpresa(empresaId).then(function (total) {
                if (typeof renderAll !== 'undefined') {
                    renderAll();
                }
                alert('✅ Dados recarregados do servidor! ' + total + ' itens carregados.');
            }).catch(function (err) {
                console.error('❌ Erro ao carregar dados:', err);
                alert('❌ Erro ao carregar dados do servidor.\n\nErro: ' + err);
            });
        } else {
            alert('⚠️ Serviço Firestore não disponível.');
        }
    };

    // =============================================
    // ===== HELPER FUNCTIONS =====
    // =============================================
    function getClienteNome(id) {
        if (!id) return 'Cliente não definido';
        var clientes = DB.getAll('clientes');
        var idStr = String(id);
        var cliente = clientes.find(function (c) { return String(c.id) === idStr; });
        if (!cliente) return 'Cliente #' + id;

        if (cliente.tipoCliente === 'cnpj') {
            return cliente.nomeFantasia || cliente.nome || cliente.razaoSocial || 'Cliente #' + id;
        }
        return cliente.nome || 'Cliente sem nome';
    }

    function getCliente(id) {
        if (!id) return null;
        var clientes = DB.getAll('clientes');
        var idStr = String(id);
        return clientes.find(function (c) { return String(c.id) === idStr; }) || null;
    }

    function getClienteDocumento(id) {
        var c = getCliente(id);
        return c ? c.documento : 'N/A';
    }

    function getClienteTipo(id) {
        var c = getCliente(id);
        return c ? c.tipoCliente : 'N/A';
    }

    function getClienteEndereco(id) {
        var c = getCliente(id);
        return c ? c.endereco : 'N/A';
    }

    function getClienteTelefone(id) {
        var c = getCliente(id);
        return c ? c.telefone : 'N/A';
    }

    function getStatusBadge(status) {
        var map = {
            'Concluída': 'success',
            'Concluído': 'success',
            'Concluida': 'success',
            'Em andamento': 'warning',
            'Pendente': 'danger',
            'Agendada': 'info',
            'Agendado': 'info',
            'Cancelada': 'danger',
            'Cancelado': 'danger',
            'Rascunho': 'info',
            'Enviado': 'warning',
            'Aprovado': 'success',
            'Rejeitado': 'danger'
        };
        return '<span class="badge ' + (map[status] || 'info') + '">' + status + '</span>';
    }

    function getGravidadeBadge(gravidade) {
        var map = {
            'Baixa': 'success',
            'Média': 'warning',
            'Alta': 'danger',
            'Crítica': 'danger'
        };
        return '<span class="badge ' + (map[gravidade] || 'info') + '">' + gravidade + '</span>';
    }

    function formatCurrency(value) {
        return 'R$ ' + (value || 0).toFixed(2).replace('.', ',');
    }

    function gerarNumeroOS() {
        var ordens = DB.getAll('ordens');
        var numeros = ordens.map(function (o) {
            var num = parseInt(o.numero ? o.numero.replace('OS-', '') : '0');
            return isNaN(num) ? 0 : num;
        });
        var max = numeros.length > 0 ? Math.max.apply(null, numeros) : 0;
        return 'OS-' + String(max + 1).padStart(3, '0');
    }

    function gerarNumeroOrcamento() {
        var orcamentos = DB.getAll('orcamentos');
        var numeros = orcamentos.map(function (o) {
            var num = parseInt(o.numero ? o.numero.replace('ORC-', '') : '0');
            return isNaN(num) ? 0 : num;
        });
        var max = numeros.length > 0 ? Math.max.apply(null, numeros) : 0;
        return 'ORC-' + String(max + 1).padStart(4, '0');
    }

    function getTipoIcon(tipo) {
        if (tipo === 'porta-isca') return '🚪';
        if (tipo === 'tunel') return '🕳️';
        return '📌';
    }

    function getCategoriaIcon(categoria) {
        var map = {
            'nao-conformidade': 'fa-exclamation-triangle',
            'desratizacao': 'fa-rat',
            'desinsetizacao': 'fa-bug',
            'descupinizacao': 'fa-tree'
        };
        return map[categoria] || 'fa-file';
    }

    function getCategoriaLabel(categoria) {
        var map = {
            'nao-conformidade': 'Não Conformidades',
            'desratizacao': 'Desratização',
            'desinsetizacao': 'Desinsetização',
            'descupinizacao': 'Descupinização'
        };
        return map[categoria] || categoria;
    }

    function getCategoriaColor(categoria) {
        var map = {
            'nao-conformidade': '#c0392b',
            'desratizacao': '#e67e22',
            'desinsetizacao': '#1d7a6b',
            'descupinizacao': '#8e44ad'
        };
        return map[categoria] || '#2c5c6b';
    }

    // ===== FUNÇÕES DE VALIDADE DOS SERVIÇOS =====
    function getValidadeServico(tipo) {
        var map = {
            'Desratização': 90,
            'Desinsetização': 90,
            'Descupinização': 365
        };
        return map[tipo] || null;
    }

    function calcularValidadeServico(servico) {
        if (!servico || !servico.data) return null;

        var diasValidade = getValidadeServico(servico.tipo);
        if (!diasValidade) return null;

        var partes = servico.data.split('/');
        var dataServico = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));

        var dataVencimento = new Date(dataServico);
        dataVencimento.setDate(dataVencimento.getDate() + diasValidade);

        var hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        dataVencimento.setHours(0, 0, 0, 0);

        var diasRestantes = Math.ceil((dataVencimento - hoje) / (1000 * 60 * 60 * 24));

        return {
            dataVencimento: dataVencimento,
            diasRestantes: diasRestantes,
            diasValidade: diasValidade,
            status: diasRestantes < 0 ? 'vencido' :
                diasRestantes <= 7 ? 'critico' :
                    diasRestantes <= 30 ? 'proximo' : 'valido'
        };
    }

    function getValidadeBadge(servico) {
        var validade = calcularValidadeServico(servico);
        if (!validade) return '<span class="badge info">Sem validade</span>';

        var diasRestantes = validade.diasRestantes;
        var status = validade.status;
        var dataStr = validade.dataVencimento.toLocaleDateString('pt-BR');

        var badgeClass = 'success';
        var icon = '✅';
        var label = 'Válido (' + diasRestantes + ' dias)';

        if (status === 'vencido') {
            badgeClass = 'danger';
            icon = '❌';
            label = 'Vencido há ' + Math.abs(diasRestantes) + ' dias';
        } else if (status === 'critico') {
            badgeClass = 'danger';
            icon = '🔴';
            label = 'Vence em ' + diasRestantes + ' dias';
        } else if (status === 'proximo') {
            badgeClass = 'warning';
            icon = '🟡';
            label = 'Vence em ' + diasRestantes + ' dias';
        } else {
            badgeClass = 'success';
            icon = '🟢';
            label = 'Válido (' + diasRestantes + ' dias)';
        }

        return '<span class="badge ' + badgeClass + '" title="Vence em: ' + dataStr + '">' + icon + ' ' + label + '</span>';
    }

    // ===== LISTAS PARA CHECKBOXES =====
    var SERVICOS_LIST = ['Inspeção', 'Manutenção', 'Reforço', 'Serviço Novo', 'Desinsetização', 'Desratização', 'Descupinização', 'Expurgo de Grãos'];
    var PRAGAS_LIST = ['Barata P. Americana', 'Barata B. Germânica', 'Escorpião', 'Cupim M. Seca', 'Pulga', 'Formiga Doceira', 'Formiga de Roça', 'Mosca', 'Traça', 'Mosquito', 'Imbua', 'Cupim Arborícola', 'Carrapato', 'Camundongo', 'Ratazana', 'Rato preto'];
    var METODOS_LIST = ['Gel Baraticida', 'Gel Formicida', 'Aerossol', 'Refil P. Mosca', 'Isca Fresca', 'Pó de Contato', 'Barreira Raticida -- Túnel', 'Barreira Raticida- Pip', 'P. Adesiva', 'Barreira Liquida Inseticida', 'Barreira liquida Cupinicida', 'Barreira Solvente Cupinicida'];

    function gerarCheckboxes(lista, valoresSelecionados, classe, disabled) {
        var isDisabled = disabled ? 'disabled' : '';
        var labelClass = disabled ? 'disabled' : '';
        return lista.map(function (item) {
            var checked = (valoresSelecionados || []).indexOf(item) !== -1 ? 'checked' : '';
            return '<div class="checkbox-item">' +
                '<input type="checkbox" class="' + classe + '" value="' + item + '" ' + checked + ' ' + isDisabled + '>' +
                '<label class="' + labelClass + '">' + item + '</label>' +
                '</div>';
        }).join('');
    }

    // =============================================
    // ===== FILTROS DO DASHBOARD =====
    // =============================================
    var filtroTipoServico = 'todos';
    var filtroStatusOS = 'todos';
    var filtroMesDashboard = '';

    window.aplicarFiltrosDashboard = function () {
        var elTipo = document.getElementById('filtroTipoServico');
        var elStatus = document.getElementById('filtroStatusOS');
        var elMes = document.getElementById('filtroMesDashboard');
        if (elTipo) filtroTipoServico = elTipo.value;
        if (elStatus) filtroStatusOS = elStatus.value;
        if (elMes) filtroMesDashboard = elMes.value;
        renderDashboard();
    };

    window.limparFiltrosDashboard = function () {
        var elTipo = document.getElementById('filtroTipoServico');
        var elStatus = document.getElementById('filtroStatusOS');
        var elMes = document.getElementById('filtroMesDashboard');
        if (elTipo) elTipo.value = 'todos';
        if (elStatus) elStatus.value = 'todos';
        if (elMes) elMes.value = '';
        filtroTipoServico = 'todos';
        filtroStatusOS = 'todos';
        filtroMesDashboard = '';
        renderDashboard();
    };

    // ===== ZERAMENTO MENSAL =====
    function verificarZeramentoMensal() {
        var key = DB.getFullKey('ultimo_reset');
        var ultimoReset = localStorage.getItem(key);
        var hoje = new Date();
        var mesAtual = hoje.getMonth();
        var anoAtual = hoje.getFullYear();
        var chaveMes = anoAtual + '-' + String(mesAtual + 1).padStart(2, '0');

        if (ultimoReset !== chaveMes) {
            var servicos = DB.getAll('servicos');
            var ordens = DB.getAll('ordens');

            var backupMensal = {
                mes: chaveMes,
                data: new Date().toISOString(),
                servicos: servicos,
                ordens: ordens,
                totalServicos: servicos.length,
                totalOrdens: ordens.length
            };

            var histKey = DB.getFullKey('historico_mensal');
            var historicoMensal = JSON.parse(localStorage.getItem(histKey) || '[]');
            historicoMensal.push(backupMensal);
            localStorage.setItem(histKey, JSON.stringify(historicoMensal));

            localStorage.setItem(key, chaveMes);
        }
    }

    // ===== FUNÇÃO PARA MAPEAR STATUS DO SERVIÇO PARA OS =====
    function mapearStatusServicoParaOS(statusServico) {
        var map = {
            'Concluído': 'Concluída',
            'Concluida': 'Concluída',
            'Concluída': 'Concluída',
            'Em andamento': 'Em andamento',
            'Pendente': 'Pendente',
            'Agendado': 'Pendente',
            'Agendada': 'Pendente',
            'Cancelado': 'Cancelada',
            'Cancelada': 'Cancelada'
        };
        return map[statusServico] || 'Pendente';
    }

    // =============================================
    // ===== VERIFICA CERTIFICADO AUTOMÁTICO =====
    // =============================================
    function verificarCertificadoAutomatico(servico) {
        if (!servico) return;

        if (servico.status === 'Concluído' || servico.status === 'Concluida' || servico.status === 'Concluída') {
            const certificados = CertificadoService.listarCertificados();
            const existe = certificados.some(c => String(c.servicoId) === String(servico.id));

            if (!existe) {
                try {
                    let tipoCertificado = servico.tipo || 'Desinsetização';
                    if (servico.tipos && servico.tipos.length > 1) {
                        tipoCertificado = servico.tipos[0];
                    }
                    const certificado = CertificadoService.gerarCertificado(servico.id, tipoCertificado);
                    
                    if (certificado && servico.tipos && servico.tipos.length > 1) {
                        DB.update('certificados', certificado.id, {
                            tiposServico: servico.tipos,
                            descricaoCompleta: servico.tipos.join(' + ')
                        });
                    }
                    
                    return certificado;
                } catch (error) {
                    console.warn('Erro ao gerar certificado automático:', error);
                }
            }
        }
        return null;
    }

    // =============================================
    // ===== SINCRONIZAÇÃO SERVIÇO ↔ ORDEM DE SERVIÇO =====
    // =============================================
    function sincronizarServicoComOS(servico, acao) {
        if (!servico) return;

        var ordens = DB.getAll('ordens');
        var osVinculada = ordens.find(function (o) { return o.servicoId === servico.id; });

        if (acao === 'remove') {
            if (osVinculada) {
                DB.update('ordens', osVinculada.id, {
                    servicoId: null,
                    status: 'Cancelada',
                    atualizadoEm: new Date().toISOString()
                });
            }
            return;
        }

        var statusOS = mapearStatusServicoParaOS(servico.status);
        var valorServico = servico.valor || 0;

        if (osVinculada) {
            var itensAtualizados = osVinculada.itens || [];
            var valorTotal = valorServico;

            if (itensAtualizados.length > 0) {
                itensAtualizados[0] = Object.assign({}, itensAtualizados[0], {
                    valorUnitario: valorServico,
                    quantidade: 1,
                    descricao: servico.tipo || itensAtualizados[0].descricao
                });
                valorTotal = itensAtualizados.reduce(function (sum, item) {
                    return sum + (item.quantidade * (item.valorUnitario || 0));
                }, 0);
            } else if (valorServico > 0) {
                itensAtualizados = [{
                    descricao: servico.tipo || 'Serviço',
                    quantidade: 1,
                    valorUnitario: valorServico
                }];
                valorTotal = valorServico;
            }

            DB.update('ordens', osVinculada.id, {
                clienteId: servico.clienteId,
                data: servico.data,
                status: statusOS,
                valorTotal: valorTotal,
                itens: itensAtualizados,
                atualizadoEm: new Date().toISOString()
            });
        } else if (acao === 'add' || acao === 'update') {
            var numeroOS = gerarNumeroOS();

            var itens = [];
            if (valorServico > 0) {
                itens.push({
                    descricao: servico.tipo || 'Serviço',
                    quantidade: 1,
                    valorUnitario: valorServico
                });
            }

            DB.add('ordens', {
                numero: numeroOS,
                clienteId: servico.clienteId,
                data: servico.data,
                status: statusOS,
                servicoId: servico.id,
                itens: itens,
                valorTotal: valorServico,
                observacoes: 'OS gerada automaticamente a partir do serviço #' + String(servico.id).padStart(3, '0'),
                areaLiberada: '',
                dataEntrega: '',
                assinaturaOperador: null,
                assinaturaCliente: null,
                garantia: '',
                criadoEm: new Date().toISOString(),
                atualizadoEm: new Date().toISOString()
            });
        }
    }

    // =============================================
    // ===== SINCRONIZAÇÃO SERVIÇO ↔ AGENDA =====
    // =============================================
    function sincronizarServicoComAgenda(servico, acao, servicoAntigo) {
        if (!servico) return;


        var cliente = getCliente(servico.clienteId);
        var clienteNome = cliente ? cliente.nome : 'Cliente #' + servico.clienteId;

        var statusMap = {
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

        var statusInfo = statusMap[servico.status] || { emoji: '📌', label: servico.status };
        var statusEmoji = statusInfo.emoji;
        var statusLabel = statusInfo.label;
        var valorFormatado = servico.valor ? servico.valor.toFixed(2).replace('.', ',') : '0,00';
        var tiposStr = servico.tipos && servico.tipos.length > 0 ? servico.tipos.join(' + ') : servico.tipo;
        var descricao = 'Serviço #' + String(servico.id).padStart(3, '0') + ': ' + tiposStr + ' - ' + statusEmoji + ' ' + statusLabel + ' (R$ ' + valorFormatado + ')';

        var agendaKey = DB.getFullKey('agenda');
        var agendaItems = JSON.parse(localStorage.getItem(agendaKey) || '[]');
        var agendamentoExistente = agendaItems.find(function (a) {
            return a.servicoId === servico.id;
        });


        if (agendamentoExistente) {
            var horario = servico.horario || agendamentoExistente.horario || '09:00';
            var index = agendaItems.findIndex(function (a) {
                return a.id === agendamentoExistente.id;
            });

            if (index !== -1) {
                agendaItems[index] = {
                    id: agendamentoExistente.id,
                    clienteId: servico.clienteId,
                    data: servico.data,
                    horario: horario,
                    descricao: descricao,
                    servicoId: servico.id,
                    statusServico: servico.status,
                    tipoServico: servico.tipo,
                    tiposServico: servico.tipos || [servico.tipo],
                    sincronizado: true,
                    clienteNome: clienteNome,
                    criadoEm: agendamentoExistente.criadoEm || new Date().toISOString(),
                    atualizadoEm: new Date().toISOString()
                };

                localStorage.setItem(agendaKey, JSON.stringify(agendaItems));
                DB.forceClearCache('agenda');
                return agendaItems[index];
            }
        }

        if (acao === 'remove') {
            if (agendamentoExistente) {
                var filteredItems = agendaItems.filter(function (a) {
                    return a.servicoId !== servico.id;
                });
                localStorage.setItem(agendaKey, JSON.stringify(filteredItems));
                DB.forceClearCache('agenda');
            }
            return;
        }

        if (acao === 'add' || (acao === 'update' && !agendamentoExistente)) {
            var horarioBase = servico.horario || '09:00';
            var maxId = agendaItems.reduce(function (max, a) {
                var id = typeof a.id === 'number' ? a.id : parseInt(a.id) || 0;
                return Math.max(max, id);
            }, 0);
            var novoId = maxId + 1;

            var novoAgendamento = {
                id: novoId,
                clienteId: servico.clienteId,
                data: servico.data,
                horario: horarioBase,
                descricao: descricao,
                servicoId: servico.id,
                statusServico: servico.status,
                tipoServico: servico.tipo,
                tiposServico: servico.tipos || [servico.tipo],
                sincronizado: true,
                clienteNome: clienteNome,
                criadoEm: new Date().toISOString(),
                atualizadoEm: new Date().toISOString()
            };

            agendaItems.push(novoAgendamento);
            localStorage.setItem(agendaKey, JSON.stringify(agendaItems));
            DB.forceClearCache('agenda');
            return novoAgendamento;
        }
    }

    // =============================================
    // ===== FUNÇÃO DE SINCRONIZAÇÃO COMPLETA =====
    // =============================================
    function sincronizarServicoCompleto(servico, acao, servicoAntigo) {
        sincronizarServicoComAgenda(servico, acao, servicoAntigo);
        sincronizarServicoComOS(servico, acao);

        if (servico.clienteId) {
            var cliente = getCliente(servico.clienteId);
            if (cliente) {
                DB.update('clientes', servico.clienteId, {
                    ultimoServico: servico.data || new Date().toLocaleDateString('pt-BR'),
                    atualizadoEm: new Date().toISOString()
                });
            }
        }

        if (servico.status === 'Concluído' || servico.status === 'Concluida' || servico.status === 'Concluída') {
            verificarCertificadoAutomatico(servico);
        }

        DB._clearAllCaches();
    }

    // =============================================
    // ===== FUNÇÕES DE RENDERIZAÇÃO =====
    // =============================================

    // =============================================
    // ===== RENDER DASHBOARD =====
    // =============================================
    function renderDashboard() {
        var clientes = DB.getAll('clientes');
        var servicos = DB.getAll('servicos');
        var ordens = DB.getAll('ordens');
        var equipe = DB.getAll('equipe');

        if (filtroTipoServico !== 'todos') {
            servicos = servicos.filter(function (s) { return s.tipo === filtroTipoServico; });
        }

        if (filtroStatusOS !== 'todos') {
            ordens = ordens.filter(function (o) { return o.status === filtroStatusOS; });
        }

        if (filtroMesDashboard) {
            var filtroParts = filtroMesDashboard.split('-');
            var ano = parseInt(filtroParts[0]);
            var mes = parseInt(filtroParts[1]);
            servicos = servicos.filter(function (s) {
                var partes = s.data.split('/');
                return parseInt(partes[2]) === ano && parseInt(partes[1]) === mes;
            });
            ordens = ordens.filter(function (o) {
                var partes = o.data.split('/');
                return parseInt(partes[2]) === ano && parseInt(partes[1]) === mes;
            });
        }

        var elClientes = document.getElementById('totalClientes');
        var elServicosHoje = document.getElementById('totalServicosHoje');
        var elEquipe = document.getElementById('totalEquipeCampo');
        var elOS = document.getElementById('totalOS');

        if (elClientes) elClientes.textContent = clientes.length;
        if (elServicosHoje) {
            var hoje = new Date().toLocaleDateString('pt-BR');
            elServicosHoje.textContent = servicos.filter(function (s) { return s.data === hoje; }).length;
        }
        if (elEquipe) elEquipe.textContent = equipe.length;
        if (elOS) elOS.textContent = ordens.length;

        var statusOS = {};
        ordens.forEach(function (o) { statusOS[o.status] = (statusOS[o.status] || 0) + 1; });
        var statusOSHtml = Object.entries(statusOS).map(function (entry) {
            var stat = entry[0];
            var qtd = entry[1];
            return '<div class="chart-stat"><span class="label">' + stat + '</span><span class="value">' + qtd + '</span></div>';
        }).join('');
        var elStatusOrdens = document.getElementById('statusOrdens');
        if (elStatusOrdens) elStatusOrdens.innerHTML = statusOSHtml || '<p style="color:#999;">Nenhuma OS cadastrada</p>';

        var tipos = {};
        servicos.forEach(function (s) { 
            var tiposServico = s.tipos || [s.tipo];
            tiposServico.forEach(function(t) {
                tipos[t] = (tipos[t] || 0) + 1;
            });
        });
        var tiposHtml = Object.entries(tipos).map(function (entry) {
            var tipo = entry[0];
            var qtd = entry[1];
            return '<div class="chart-stat"><span class="label">' + tipo + '</span><span class="value">' + qtd + '</span></div>';
        }).join('');
        var elServicosTipo = document.getElementById('servicosPorTipo');
        if (elServicosTipo) elServicosTipo.innerHTML = tiposHtml || '<p style="color:#999;">Nenhum serviço cadastrado</p>';

        renderResumoMensal();
    }

    // =============================================
    // ===== RESUMO MENSAL =====
    // =============================================
    function renderResumoMensal() {
        var servicos = DB.getAll('servicos');
        var ordens = DB.getAll('ordens');
        var hoje = new Date();
        var mesAtual = hoje.getMonth();
        var anoAtual = hoje.getFullYear();

        var servicosMes = servicos.filter(function (s) {
            var partes = s.data.split('/');
            var dataServico = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
            return dataServico.getMonth() === mesAtual && dataServico.getFullYear() === anoAtual;
        });

        var ordensMes = ordens.filter(function (o) {
            var partes = o.data.split('/');
            var dataOS = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
            return dataOS.getMonth() === mesAtual && dataOS.getFullYear() === anoAtual;
        });

        if (filtroTipoServico !== 'todos') {
            servicosMes = servicosMes.filter(function (s) { return s.tipo === filtroTipoServico; });
        }
        if (filtroStatusOS !== 'todos') {
            ordensMes = ordensMes.filter(function (o) { return o.status === filtroStatusOS; });
        }
        if (filtroMesDashboard) {
            var filtroParts = filtroMesDashboard.split('-');
            var ano = parseInt(filtroParts[0]);
            var mes = parseInt(filtroParts[1]);
            servicosMes = servicosMes.filter(function (s) {
                var partes = s.data.split('/');
                return parseInt(partes[2]) === ano && parseInt(partes[1]) === mes;
            });
            ordensMes = ordensMes.filter(function (o) {
                var partes = o.data.split('/');
                return parseInt(partes[2]) === ano && parseInt(partes[1]) === mes;
            });
        }

        var tipos = {};
        servicosMes.forEach(function (s) {
            var tiposServico = s.tipos || [s.tipo];
            tiposServico.forEach(function(t) {
                tipos[t] = (tipos[t] || 0) + 1;
            });
        });

        var statusOS = {};
        ordensMes.forEach(function (o) {
            statusOS[o.status] = (statusOS[o.status] || 0) + 1;
        });

        var totalFaturado = 0;
        var servicosIdsJaContabilizados = new Set();

        servicosMes.forEach(function (s) {
            if (s.status === 'Concluído' || s.status === 'Concluída' || s.status === 'Concluida') {
                if (s.valor && s.valor > 0) {
                    totalFaturado += s.valor;
                    servicosIdsJaContabilizados.add(s.id);
                }
            }
        });

        ordensMes.forEach(function (o) {
            if (o.status === 'Concluída' || o.status === 'Concluído') {
                if (o.servicoId && servicosIdsJaContabilizados.has(o.servicoId)) {
                    return;
                }

                var valorOS = 0;
                if (o.itens && o.itens.length > 0) {
                    valorOS = o.itens.reduce(function (sum, item) {
                        return sum + (item.quantidade * (item.valorUnitario || 0));
                    }, 0);
                } else if (o.valorTotal) {
                    valorOS = o.valorTotal;
                }

                if (valorOS > 0) {
                    totalFaturado += valorOS;
                }
            }
        });

        var mesNome = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        var elMes = document.getElementById('mesReferencia');
        if (elMes) elMes.textContent = '- ' + mesNome;

        var html = '';
        html += '<div class="resumo-mensal-item destaque">' +
            '<span class="numero">' + servicosMes.length + '</span>' +
            '<span class="label">Total de Serviços</span>' +
            '</div>';
        html += '<div class="resumo-mensal-item">' +
            '<span class="numero">' + ordensMes.length + '</span>' +
            '<span class="label">Total de OS</span>' +
            '</div>';
        html += '<div class="resumo-mensal-item">' +
            '<span class="numero">' + Object.keys(tipos).length + '</span>' +
            '<span class="label">Tipos de Serviço</span>' +
            '</div>';
        html += '<div class="resumo-mensal-item destaque" style="background: #0b2a3b; border-color: #0b2a3b;">' +
            '<span class="numero" style="color: white;">' + formatCurrency(totalFaturado) + '</span>' +
            '<span class="label" style="color: white;">Faturamento do Mês</span>' +
            '</div>';

        var tipoEntries = Object.entries(tipos);
        tipoEntries.forEach(function (entry) {
            var tipo = entry[0];
            var qtd = entry[1];
            html += '<div class="resumo-mensal-item">' +
                '<span class="numero">' + qtd + '</span>' +
                '<span class="label">' + tipo + '</span>' +
                '</div>';
        });

        var statusEntries = Object.entries(statusOS);
        statusEntries.forEach(function (entry) {
            var status = entry[0];
            var qtd = entry[1];
            var emoji = status === 'Concluída' || status === 'Concluído' ? '✅' :
                status === 'Em andamento' ? '🔄' :
                    status === 'Pendente' ? '⏳' : '❌';
            html += '<div class="resumo-mensal-item">' +
                '<span class="numero">' + qtd + '</span>' +
                '<span class="label">' + emoji + ' ' + status + '</span>' +
                '</div>';
        });

        var elResumo = document.getElementById('resumoMensal');
        if (elResumo) elResumo.innerHTML = html;
    }

    // =============================================
    // ===== EXPORTAÇÃO EXCEL =====
    // =============================================
    window.exportarDashboardExcel = function () {
        var servicos = DB.getAll('servicos');
        var ordens = DB.getAll('ordens');
        var clientes = DB.getAll('clientes');

        var servicosFiltrados = servicos;
        var ordensFiltradas = ordens;

        if (filtroTipoServico !== 'todos') {
            servicosFiltrados = servicosFiltrados.filter(function (s) { return s.tipo === filtroTipoServico; });
        }
        if (filtroStatusOS !== 'todos') {
            ordensFiltradas = ordensFiltradas.filter(function (o) { return o.status === filtroStatusOS; });
        }
        if (filtroMesDashboard) {
            var filtroParts = filtroMesDashboard.split('-');
            var ano = parseInt(filtroParts[0]);
            var mes = parseInt(filtroParts[1]);
            servicosFiltrados = servicosFiltrados.filter(function (s) {
                var partes = s.data.split('/');
                return parseInt(partes[2]) === ano && parseInt(partes[1]) === mes;
            });
            ordensFiltradas = ordensFiltradas.filter(function (o) {
                var partes = o.data.split('/');
                return parseInt(partes[2]) === ano && parseInt(partes[1]) === mes;
            });
        }

        var wb = XLSX.utils.book_new();

        var servicosData = servicosFiltrados.map(function (s) {
            return {
                'ID': s.id,
                'Cliente': getClienteNome(s.clienteId),
                'Tipo': s.tipo,
                'Data': s.data,
                'Status': s.status,
                'Valor': s.valor || 0
            };
        });
        var wsServicos = XLSX.utils.json_to_sheet(servicosData);
        XLSX.utils.book_append_sheet(wb, wsServicos, 'Serviços');

        var ordensData = ordensFiltradas.map(function (o) {
            return {
                'OS': o.numero,
                'Cliente': getClienteNome(o.clienteId),
                'Data': o.data,
                'Status': o.status,
                'Valor Total': o.valorTotal || 0,
                'Itens': o.inseticidasUtilizados ? o.inseticidasUtilizados.length : 0
            };
        });
        var wsOrdens = XLSX.utils.json_to_sheet(ordensData);
        XLSX.utils.book_append_sheet(wb, wsOrdens, 'Ordens de Serviço');

        var resumoData = [
            { 'Métrica': 'Total de Serviços', 'Valor': servicosFiltrados.length },
            { 'Métrica': 'Total de OS', 'Valor': ordensFiltradas.length },
            { 'Métrica': 'Total de Clientes', 'Valor': clientes.length }
        ];

        var tiposCount = {};
        servicosFiltrados.forEach(function (s) {
            var tiposServico = s.tipos || [s.tipo];
            tiposServico.forEach(function(t) {
                tiposCount[t] = (tiposCount[t] || 0) + 1;
            });
        });
        var tipoEntries = Object.entries(tiposCount);
        tipoEntries.forEach(function (entry) {
            var tipo = entry[0];
            var qtd = entry[1];
            resumoData.push({ 'Métrica': 'Serviços - ' + tipo, 'Valor': qtd });
        });

        var statusCount = {};
        ordensFiltradas.forEach(function (o) {
            statusCount[o.status] = (statusCount[o.status] || 0) + 1;
        });
        var statusEntries = Object.entries(statusCount);
        statusEntries.forEach(function (entry) {
            var status = entry[0];
            var qtd = entry[1];
            resumoData.push({ 'Métrica': 'OS - ' + status, 'Valor': qtd });
        });

        var wsResumo = XLSX.utils.json_to_sheet(resumoData);
        XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

        XLSX.writeFile(wb, 'dashboard_' + new Date().toISOString().split('T')[0] + '.xlsx');
    };

    // =============================================
    // ===== EXPORTAÇÃO PDF =====
    // =============================================
    window.exportarDashboardPDF = function () {
        var doc = new window.jspdf.jsPDF('p', 'mm', 'a4');

        var servicos = DB.getAll('servicos');
        var ordens = DB.getAll('ordens');
        var clientes = DB.getAll('clientes');

        var servicosFiltrados = servicos;
        var ordensFiltradas = ordens;

        if (filtroTipoServico !== 'todos') {
            servicosFiltrados = servicosFiltrados.filter(function (s) { return s.tipo === filtroTipoServico; });
        }
        if (filtroStatusOS !== 'todos') {
            ordensFiltradas = ordensFiltradas.filter(function (o) { return o.status === filtroStatusOS; });
        }
        if (filtroMesDashboard) {
            var filtroParts = filtroMesDashboard.split('-');
            var ano = parseInt(filtroParts[0]);
            var mes = parseInt(filtroParts[1]);
            servicosFiltrados = servicosFiltrados.filter(function (s) {
                var partes = s.data.split('/');
                return parseInt(partes[2]) === ano && parseInt(partes[1]) === mes;
            });
            ordensFiltradas = ordensFiltradas.filter(function (o) {
                var partes = o.data.split('/');
                return parseInt(partes[2]) === ano && parseInt(partes[1]) === mes;
            });
        }

        var config = DB.getConfig();
        var titulo = (config && config.empresa && config.empresa.nome) ? config.empresa.nome : 'Click Saúde Ambiental';

        doc.setFontSize(18);
        doc.text(titulo, 105, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text('Dashboard - Relatório Gerencial', 105, 30, { align: 'center' });
        doc.text('Data: ' + new Date().toLocaleDateString('pt-BR'), 105, 37, { align: 'center' });

        doc.setFontSize(11);
        doc.text('Total de Serviços: ' + servicosFiltrados.length, 20, 50);
        doc.text('Total de OS: ' + ordensFiltradas.length, 20, 57);
        doc.text('Total de Clientes: ' + clientes.length, 20, 64);

        var tiposCount = {};
        servicosFiltrados.forEach(function (s) {
            var tiposServico = s.tipos || [s.tipo];
            tiposServico.forEach(function(t) {
                tiposCount[t] = (tiposCount[t] || 0) + 1;
            });
        });

        var yPos = 80;
        doc.setFontSize(12);
        doc.text('Serviços por Tipo', 20, yPos);
        yPos += 6;

        var tipoData = Object.entries(tiposCount).map(function (entry) {
            return [entry[0], entry[1].toString()];
        });
        if (tipoData.length === 0) {
            tipoData.push(['Nenhum serviço', '0']);
        }

        doc.autoTable({
            startY: yPos,
            head: [['Tipo de Serviço', 'Quantidade']],
            body: tipoData,
            theme: 'striped',
            headStyles: { fillColor: [11, 42, 59] },
            styles: { fontSize: 9 },
            margin: { left: 20 }
        });

        var statusCount = {};
        ordensFiltradas.forEach(function (o) {
            statusCount[o.status] = (statusCount[o.status] || 0) + 1;
        });

        var statusData = Object.entries(statusCount).map(function (entry) {
            return [entry[0], entry[1].toString()];
        });
        if (statusData.length === 0) {
            statusData.push(['Nenhuma OS', '0']);
        }

        if (doc.lastAutoTable.finalY > 230) {
            doc.addPage();
        }

        doc.text('Ordens de Serviço por Status', 20, doc.lastAutoTable.finalY + 15);

        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 22,
            head: [['Status', 'Quantidade']],
            body: statusData,
            theme: 'striped',
            headStyles: { fillColor: [11, 42, 59] },
            styles: { fontSize: 9 },
            margin: { left: 20 }
        });

        var finalY = doc.lastAutoTable.finalY + 15;
        doc.setFontSize(8);
        doc.text('Relatório gerado em ' + new Date().toLocaleString('pt-BR'), 105, finalY, { align: 'center' });
        doc.text((config && config.empresa && config.empresa.nome ? config.empresa.nome : 'Click Saúde Ambiental') + ' - ' + (config && config.empresa && config.empresa.cnpj ? config.empresa.cnpj : ''), 105, finalY + 5, { align: 'center' });

        doc.save('dashboard_' + new Date().toISOString().split('T')[0] + '.pdf');
    };

    // =============================================
    // ===== CONFIGURAÇÕES =====
    // =============================================
    function carregarConfiguracoes() {
        var config = DB.getConfig();

        if (!config) {
            config = JSON.parse(JSON.stringify(CONFIG_PADRAO));
        }
        if (!config.empresa) {
            config.empresa = JSON.parse(JSON.stringify(CONFIG_PADRAO.empresa));
        }
        if (!config.relatorio) {
            config.relatorio = JSON.parse(JSON.stringify(CONFIG_PADRAO.relatorio));
        }

        var elNome = document.getElementById('configEmpresaNome');
        var elCnpj = document.getElementById('configEmpresaCnpj');
        var elTelefone = document.getElementById('configEmpresaTelefone');
        var elEndereco = document.getElementById('configEmpresaEndereco');
        var elEmail = document.getElementById('configEmpresaEmail');
        var elTitulo = document.getElementById('configRelatorioTitulo');
        var elSubtitulo = document.getElementById('configRelatorioSubtitulo');
        var elCor = document.getElementById('configRelatorioCor');
        var elRodape = document.getElementById('configRelatorioRodape');
        var elLogo = document.getElementById('logoPreview');

        if (elNome) elNome.value = config.empresa.nome || '';
        if (elCnpj) elCnpj.value = config.empresa.cnpj || '';
        if (elTelefone) elTelefone.value = config.empresa.telefone || '';
        if (elEndereco) elEndereco.value = config.empresa.endereco || '';
        if (elEmail) elEmail.value = config.empresa.email || '';
        if (elTitulo) elTitulo.value = config.relatorio.titulo || '';
        if (elSubtitulo) elSubtitulo.value = config.relatorio.subtitulo || '';
        if (elCor) elCor.value = config.relatorio.cor || '#0b2a3b';
        if (elRodape) elRodape.value = config.relatorio.rodape || '';

        if (elLogo && config.empresa.logo) {
            elLogo.innerHTML = '<img src="' + config.empresa.logo + '" alt="Logo" />';
        }
    }

    window.salvarConfiguracoes = function () {
        var config = DB.getConfig();
        if (!config) config = JSON.parse(JSON.stringify(CONFIG_PADRAO));

        config.empresa = {
            nome: document.getElementById('configEmpresaNome')?.value || '',
            cnpj: document.getElementById('configEmpresaCnpj')?.value || '',
            telefone: document.getElementById('configEmpresaTelefone')?.value || '',
            endereco: document.getElementById('configEmpresaEndereco')?.value || '',
            email: document.getElementById('configEmpresaEmail')?.value || '',
            logo: config.empresa.logo || null
        };

        config.relatorio = {
            titulo: document.getElementById('configRelatorioTitulo')?.value || '',
            subtitulo: document.getElementById('configRelatorioSubtitulo')?.value || '',
            cor: document.getElementById('configRelatorioCor')?.value || '#0b2a3b',
            rodape: document.getElementById('configRelatorioRodape')?.value || ''
        };

        var inputLogo = document.getElementById('configEmpresaLogo');
        if (inputLogo && inputLogo.files && inputLogo.files[0]) {
            var reader = new FileReader();
            reader.onload = function (e) {
                config.empresa.logo = e.target.result;
                DB.setConfig(config);
                var elLogo = document.getElementById('logoPreview');
                if (elLogo) elLogo.innerHTML = '<img src="' + config.empresa.logo + '" alt="Logo" />';
                alert('Configurações salvas com sucesso!');
            };
            reader.readAsDataURL(inputLogo.files[0]);
        } else {
            DB.setConfig(config);
            alert('Configurações salvas com sucesso!');
        }
    };

    // =============================================
    // ===== RENDER ORDENS =====
    // =============================================
    function renderOrdens() {
        renderOrdensComFiltros();
    }

    // =============================================
    // ===== RENDER SERVIÇOS =====
    // =============================================
    function renderServicos() {
        renderServicosComFiltros();
    }

    // =============================================
    // ===== RENDER PROPOSTAS =====
    // =============================================
    function renderOrcamentos() {
        renderOrcamentosComFiltros();
    }

    // =============================================
    // ===== RENDER CLIENTES =====
    // =============================================
    function renderClientes() {
        DB.forceClearCache('clientes');

        var clientes = DB.getAll('clientes', true);
        var tbody = document.getElementById('tabelaClientes');
        if (!tbody) return;

        if (clientes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;padding:30px;">Nenhum cliente cadastrado</td></tr>';
            return;
        }
        tbody.innerHTML = clientes.map(function (c) {
            var tipoLabel = c.tipoCliente === 'cnpj' ? '🏢 CNPJ' : '👤 CPF';
            var tipoClass = c.tipoCliente === 'cnpj' ? 'cnpj' : 'cpf';

            var nomeExibido = c.nome || c.nomeFantasia || c.nome;
            if (c.tipoCliente === 'cnpj' && c.nomeFantasia) {
                nomeExibido = c.nomeFantasia + (c.razaoSocial ? ' <small style="color:#999;font-size:0.7rem;">(' + c.razaoSocial + ')</small>' : '');
            }

            return '<tr>' +
                '<td><strong>' + nomeExibido + '</strong></td>' +
                '<td>' + (c.documento || 'N/A') + '</td>' +
                '<td><span class="cliente-tipo-badge ' + tipoClass + '">' + tipoLabel + '</span></td>' +
                '<td>' + c.telefone + '</td>' +
                '<td>' + c.endereco + '</td>' +
                '<td>' + (c.ultimoServico || 'N/A') + '</td>' +
                '<td>' +
                '<i class="fas fa-edit" onclick="editarCliente(' + c.id + ')" title="Editar"></i>' +
                '<i class="fas fa-trash" onclick="excluirCliente(' + c.id + ')" title="Excluir" style="color:#b13e3a;"></i>' +
                '</td>' +
                '</tr>';
        }).join('');
    }

    // =============================================
    // ===== RENDER AGENDA =====
    // =============================================
    function renderAgenda() {
        renderAgendaComFiltros();
    }

    function atualizarDescricaoAgendamento(agendamento, servico) {
        var statusMap = {
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
        var statusInfo = statusMap[servico.status] || { emoji: '📌', label: servico.status };
        var valorFormatado = servico.valor ? servico.valor.toFixed(2).replace('.', ',') : '0,00';
        var tiposStr = servico.tipos && servico.tipos.length > 0 ? servico.tipos.join(' + ') : servico.tipo;
        return 'Serviço #' + String(servico.id).padStart(3, '0') + ': ' + tiposStr + ' - ' + statusInfo.emoji + ' ' + statusInfo.label + ' (R$ ' + valorFormatado + ')';
    }

    function renderMapaIscas(filtro) {
        DB.forceClearCache('pontosIscas');

        if (filtro) {
            filtrosMapa.busca = filtro.toLowerCase();
            document.getElementById('filtroMapaBusca').value = filtro;
        }

        renderMapaComFiltros();
    }

    // =============================================
    // ===== RENDER EQUIPE =====
    // =============================================
    function renderEquipe() {
        DB.forceClearCache('equipe');
        var equipe = DB.getAll('equipe', true);
        var container = document.getElementById('teamCards');
        if (!container) return;

        if (equipe.length === 0) {
            container.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#999;padding:30px;">Nenhum membro na equipe</div>';
            return;
        }
        container.innerHTML = equipe.map(function (m) {
            return '<div class="team-card">' +
                '<i class="fas fa-user-circle"></i>' +
                '<strong>' + m.nome + '</strong>' +
                '<span>' + m.cargo + '</span>' +
                '<span class="team-remove" onclick="excluirMembro(' + m.id + ')" title="Remover">&times;</span>' +
                '</div>';
        }).join('');
    }

    // =============================================
    // ===== RENDER RELATÓRIOS =====
    // =============================================
    function renderRelatorios() {
        var relatorios = DB.getAll('relatorios');
        var modelos = DB.getAll('modelos');
        var container = document.getElementById('relatorioContent');
        if (!container) return;

        var categorias = {};
        relatorios.forEach(function (r) {
            var modelo = modelos.find(function (m) { return m.id === r.modeloId; });
            var cat = modelo ? modelo.categoria : 'outros';
            if (!categorias[cat]) categorias[cat] = [];
            categorias[cat].push(Object.assign({}, r, { modelo: modelo }));
        });

        var categoriasOrdenadas = ['nao-conformidade', 'desratizacao', 'desinsetizacao', 'descupinizacao'];

        var html = '';
        categoriasOrdenadas.forEach(function (cat) {
            var itens = categorias[cat] || [];
            var cor = getCategoriaColor(cat);
            html += '<div class="relatorio-categoria">' +
                '<div class="categoria-header" style="border-left: 4px solid ' + cor + ';">' +
                '<i class="fas ' + getCategoriaIcon(cat) + '" style="color:' + cor + ';"></i>' +
                '<h3>' + getCategoriaLabel(cat) + '</h3>' +
                '<span class="badge-count">' + itens.length + '</span>' +
                '</div>' +
                '<div class="categoria-itens">' +
                (itens.length === 0 ? '<div style="padding:12px 18px;color:#999;font-size:0.9rem;">Nenhum relatório nesta categoria</div>' : '') +
                itens.map(function (r) {
                    return '<div class="relatorio-item" onclick="visualizarRelatorio(' + r.id + ')">' +
                        '<div class="relatorio-info">' +
                        '<i class="fas fa-file-alt" style="color:' + cor + ';"></i>' +
                        '<div>' +
                        '<div class="nome">' + r.titulo + '</div>' +
                        '<div class="desc">' + r.data + ' • ' + getClienteNome(r.clienteId) + '</div>' +
                        '</div>' +
                        '</div>' +
                        '<div style="display:flex;align-items:center;gap:12px;">' +
                        getStatusBadge(r.status) +
                        getGravidadeBadge(r.gravidade) +
                        (r.imagens && r.imagens.length > 0 ? '<i class="fas fa-images" style="color:#1d7a6b;" title="' + r.imagens.length + ' imagens"></i>' : '') +
                        '<div class="relatorio-actions">' +
                        '<i class="fas fa-eye" onclick="event.stopPropagation();visualizarRelatorio(' + r.id + ')" title="Visualizar"></i>' +
                        '<i class="fas fa-edit" onclick="event.stopPropagation();editarRelatorio(' + r.id + ')" title="Editar"></i>' +
                        '<i class="fas fa-download" onclick="event.stopPropagation();baixarRelatorio(' + r.id + ')" title="Baixar"></i>' +
                        '<i class="fas fa-print" onclick="event.stopPropagation();imprimirRelatorio(' + r.id + ')" title="Imprimir"></i>' +
                        '<i class="fas fa-trash" onclick="event.stopPropagation();excluirRelatorio(' + r.id + ')" title="Excluir" style="color:#b13e3a;"></i>' +
                        '</div>' +
                        '</div>' +
                        '</div>';
                }).join('') +
                '</div>' +
                '</div>';
        });

        container.innerHTML = html || '<p style="color:#999;text-align:center;padding:40px;">Nenhum relatório cadastrado</p>';
    }

    // =============================================
    // ===== CERTIFICADOS TÉCNICOS =====
    // =============================================

    function renderCertificados() {
        var filtros = {
            clienteId: document.getElementById('filtroCertCliente')?.value || '',
            tipo: document.getElementById('filtroCertTipo')?.value || '',
            status: document.getElementById('filtroCertStatus')?.value || ''
        };

        var certificados = CertificadoService.listarCertificados(filtros);
        var container = document.getElementById('certificadosGrid');
        if (!container) return;

        if (certificados.length === 0) {
            container.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;color:#999;padding:40px;">
                    <i class="fas fa-certificate" style="font-size:3rem;display:block;margin-bottom:12px;color:#dce4ec;"></i>
                    Nenhum certificado encontrado
                    <br><small style="color:#b0c8d8;">Crie um certificado a partir de um serviço concluído</small>
                </div>
            `;
            return;
        }

        container.innerHTML = certificados.map(function(c) {
            var isExpirado = new Date(c.dataValidade.split('/').reverse().join('-')) < new Date();
            var statusClass = isExpirado ? 'expirado' : 'ativo';
            var statusLabel = isExpirado ? '❌ Expirado' : '✅ Ativo';
            var clienteNome = c.cliente.nome || 'Cliente #' + c.clienteId;
            var tipoLabel = CertificadoService._getTipoLabel(c.tipo);
            
            var isCombinado = c.isCombinado || false;
            var tiposDisplay = c.tiposServico && c.tiposServico.length > 1 ? c.tiposServico.join(' + ') : '';
            
            var badgeHtml = '';
            if (isCombinado && tiposDisplay) {
                badgeHtml = '<span class="combinado-badge">📋 Combinado</span>';
            } else if (tiposDisplay) {
                badgeHtml = '<span class="multi-badge">📋 Múltiplos</span>';
            }

            return `
                <div class="certificado-card" id="certificado-card-${c.id}" data-combinado="${isCombinado}" data-multi="${!!tiposDisplay && !isCombinado}">
                    <div class="cert-info">
                        <div class="cert-titulo">
                            <i class="fas fa-${c.tipo === 'Desinsetização' ? 'bug' : c.tipo === 'Desratização' ? 'rat' : 'tree'}" 
                               style="color:#1d7a6b;margin-right:8px;"></i>
                            ${tipoLabel} - ${clienteNome}
                            ${badgeHtml}
                            ${tiposDisplay ? '<span style="font-size:0.7rem;color:#4d687a;font-weight:400;margin-left:4px;">(' + tiposDisplay + ')</span>' : ''}
                        </div>
                        <div class="cert-detalhes">
                            <span><i class="fas fa-calendar-alt"></i> Emissão: ${new Date(c.criadoEm).toLocaleDateString('pt-BR')}</span>
                            <span><i class="fas fa-clock"></i> Validade: ${c.dataValidade}</span>
                            <span><i class="fas fa-hashtag"></i> #${c.id}</span>
                            ${isCombinado ? '<span style="background:#8e44ad;color:white;padding:1px 10px;border-radius:12px;font-size:0.6rem;margin-left:4px;">Combinado</span>' : ''}
                        </div>
                    </div>
                    <div class="cert-status">
                        <span class="cert-status-badge ${statusClass}">${statusLabel}</span>
                    </div>
                    <div class="cert-actions">
                        <i class="fas fa-eye" onclick="visualizarCertificado('${c.id}')" title="Visualizar"></i>
                        <i class="fas fa-print" onclick="imprimirCertificado('${c.id}')" title="Imprimir"></i>
                        <i class="fas fa-file-pdf" onclick="baixarPDFCertificado('${c.id}')" title="Baixar PDF"></i>
                        <i class="fas fa-trash" onclick="excluirCertificado('${c.id}')" title="Excluir" style="color:#b13e3a;"></i>
                    </div>
                </div>
            `;
        }).join('');
    }

    function preencherFiltroCertificados() {
        var clientes = DB.getAll('clientes');
        var select = document.getElementById('filtroCertCliente');
        if (select) {
            var currentValue = select.value;
            select.innerHTML = '<option value="">Todos os Clientes</option>' +
                clientes.map(function(c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('');
            select.value = currentValue;
        }
    }

    window.aplicarFiltrosCertificados = function () {
        renderCertificados();
    };

    window.limparFiltrosCertificados = function () {
        document.getElementById('filtroCertCliente').value = '';
        document.getElementById('filtroCertTipo').value = '';
        document.getElementById('filtroCertStatus').value = '';
        renderCertificados();
    };

    // =============================================
    // ===== FUNÇÃO TOGGLE PARA CAMPOS DE CNPJ =====
    // =============================================
    window.toggleCamposCnpj = function () {
        var tipo = document.getElementById('modalTipoCliente')?.value || 'cpf';
        var camposCnpj = document.getElementById('camposCnpj');
        var labelNome = document.getElementById('labelNome');
        var inputNome = document.getElementById('modalNome');

        if (tipo === 'cnpj') {
            if (camposCnpj) camposCnpj.style.display = 'block';
            if (labelNome) labelNome.textContent = 'Nome Fantasia *';
            if (inputNome) {
                inputNome.placeholder = 'Nome Fantasia da empresa';
                inputNome.value = '';
            }
        } else {
            if (camposCnpj) camposCnpj.style.display = 'none';
            if (labelNome) labelNome.textContent = 'Nome *';
            if (inputNome) {
                inputNome.placeholder = 'Nome completo';
                inputNome.value = '';
            }
        }
    };

    window.toggleDocumentoCliente = function () {
        var tipo = document.getElementById('modalTipoCliente')?.value || 'cpf';
        var label = document.getElementById('labelDocumento');
        var input = document.getElementById('modalDocumento');

        if (label) {
            label.textContent = tipo === 'cpf' ? 'CPF *' : 'CNPJ *';
        }
        if (input) {
            input.placeholder = tipo === 'cpf' ? '000.000.000-00' : '00.000.000/0001-00';
            input.maxLength = tipo === 'cpf' ? 14 : 18;
            input.value = '';
        }

        toggleCamposCnpj();
    };

    // =============================================
    // ===== FUNÇÕES DE ASSINATURA DIGITAL =====
    // =============================================
    var signatureOSId = null;

    window.abrirAssinaturaOS = function (osId) {
        var os = DB.getById('ordens', osId);
        if (!os) {
            alert('Ordem de Serviço não encontrada!');
            return;
        }

        signatureOSId = osId;

        var temAssinaturaOperador = os.assinaturaOperador ? true : false;
        var temAssinaturaCliente = os.assinaturaCliente ? true : false;

        abrirModal('Assinatura Digital - OS ' + os.numero,
            '<div style="margin-bottom:16px;padding:12px;background:#f8fbfd;border-radius:8px;border-left:4px solid #8e44ad;">' +
            '<div style="display:flex;flex-wrap:wrap;gap:8px 20px;">' +
            '<span><strong>Cliente:</strong> ' + getClienteNome(os.clienteId) + '</span>' +
            '<span><strong>Data:</strong> ' + os.data + '</span>' +
            '<span><strong>Status:</strong> ' + getStatusBadge(os.status) + '</span>' +
            '</div>' +
            '</div>' +

            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">' +
            '<div class="signature-box">' +
            '<h4 style="color:#0b2a3b;margin-bottom:8px;">' +
            '<i class="fas fa-user-tie"></i> Assinatura do Operador' +
            (temAssinaturaOperador ? '<span style="color:#1d7a6b;font-size:0.8rem;"> ✅ Assinado</span>' : '') +
            '</h4>' +
            '<div class="signature-canvas-wrapper">' +
            '<canvas id="sigCanvasOperador" class="signature-canvas" width="350" height="120"></canvas>' +
            (temAssinaturaOperador ? '<img src="' + os.assinaturaOperador + '" class="signature-image" alt="Assinatura Operador" />' : '') +
            '</div>' +
            '<div class="signature-tools">' +
            '<button class="btn-secondary btn-sm" onclick="limparAssinatura(\'operador\')">' +
            '<i class="fas fa-eraser"></i> Limpar' +
            '</button>' +
            '<button class="btn-primary btn-sm" onclick="salvarAssinatura(\'operador\')">' +
            '<i class="fas fa-save"></i> Salvar' +
            '</button>' +
            (temAssinaturaOperador ? '<button class="btn-danger btn-sm" onclick="removerAssinatura(' + osId + ', \'operador\')">' +
                '<i class="fas fa-trash"></i> Remover' +
                '</button>' : '') +
            '</div>' +
            '</div>' +

            '<div class="signature-box">' +
            '<h4 style="color:#0b2a3b;margin-bottom:8px;">' +
            '<i class="fas fa-user"></i> Assinatura do Cliente' +
            (temAssinaturaCliente ? '<span style="color:#1d7a6b;font-size:0.8rem;"> ✅ Assinado</span>' : '') +
            '</h4>' +
            '<div class="signature-canvas-wrapper">' +
            '<canvas id="sigCanvasCliente" class="signature-canvas" width="350" height="120"></canvas>' +
            (temAssinaturaCliente ? '<img src="' + os.assinaturaCliente + '" class="signature-image" alt="Assinatura Cliente" />' : '') +
            '</div>' +
            '<div class="signature-tools">' +
            '<button class="btn-secondary btn-sm" onclick="limparAssinatura(\'cliente\')">' +
            '<i class="fas fa-eraser"></i> Limpar' +
            '</button>' +
            '<button class="btn-primary btn-sm" onclick="salvarAssinatura(\'cliente\')">' +
            '<i class="fas fa-save"></i> Salvar' +
            '</button>' +
            (temAssinaturaCliente ? '<button class="btn-danger btn-sm" onclick="removerAssinatura(' + osId + ', \'cliente\')">' +
                '<i class="fas fa-trash"></i> Remover' +
                '</button>' : '') +
            '</div>' +
            '</div>' +
            '</div>' +

            '<div style="margin-top:16px;padding:12px;background:#f0f7fc;border-radius:8px;border-left:4px solid #1d7a6b;font-size:0.85rem;color:#4d687a;">' +
            '<i class="fas fa-info-circle"></i> ' +
            '<strong>Instruções:</strong> Desenhe a assinatura com o mouse ou toque na tela. ' +
            'Clique em "Salvar" para confirmar. Use "Limpar" para refazer.' +
            '</div>' +

            '<div class="modal-footer">' +
            '<button class="btn-secondary" onclick="fecharModal()">Fechar</button>' +
            '<button class="btn-primary" onclick="fecharModal()">' +
            '<i class="fas fa-check"></i> Concluído' +
            '</button>' +
            '</div>'
        );

        setTimeout(function () {
            initSignatureCanvas('operador');
            initSignatureCanvas('cliente');

            var osAtual = DB.getById('ordens', osId);
            if (osAtual) {
                if (osAtual.assinaturaOperador) {
                    var canvas = document.getElementById('sigCanvasOperador');
                    if (canvas) {
                        var ctx = canvas.getContext('2d');
                        var img = new Image();
                        img.onload = function () {
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        };
                        img.src = osAtual.assinaturaOperador;
                    }
                }
                if (osAtual.assinaturaCliente) {
                    var canvas = document.getElementById('sigCanvasCliente');
                    if (canvas) {
                        var ctx = canvas.getContext('2d');
                        var img = new Image();
                        img.onload = function () {
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        };
                        img.src = osAtual.assinaturaCliente;
                    }
                }
            }
        }, 100);
    };

    function initSignatureCanvas(tipo) {
        var canvas = document.getElementById('sigCanvas' + tipo.charAt(0).toUpperCase() + tipo.slice(1));
        if (!canvas) return;

        var ctx = canvas.getContext('2d');

        ctx.lineWidth = 2;
        ctx.strokeStyle = '#0b2a3b';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.beginPath();
        ctx.strokeStyle = '#e8eff5';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.moveTo(20, canvas.height / 2);
        ctx.lineTo(canvas.width - 20, canvas.height / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        var isDrawing = false;
        var lastX = 0;
        var lastY = 0;

        function getPosition(e) {
            var rect = canvas.getBoundingClientRect();
            var scaleX = canvas.width / rect.width;
            var scaleY = canvas.height / rect.height;

            var clientX, clientY;
            if (e.touches) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
                e.preventDefault();
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }

            return {
                x: (clientX - rect.left) * scaleX,
                y: (clientY - rect.top) * scaleY
            };
        }

        function startDrawing(e) {
            e.preventDefault();
            isDrawing = true;
            var pos = getPosition(e);
            lastX = pos.x;
            lastY = pos.y;

            ctx.beginPath();
            ctx.arc(lastX, lastY, 2, 0, Math.PI * 2);
            ctx.fillStyle = '#0b2a3b';
            ctx.fill();
        }

        function draw(e) {
            e.preventDefault();
            if (!isDrawing) return;

            var pos = getPosition(e);
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(pos.x, pos.y);
            ctx.strokeStyle = '#0b2a3b';
            ctx.lineWidth = 2;
            ctx.stroke();

            lastX = pos.x;
            lastY = pos.y;
        }

        function stopDrawing(e) {
            e.preventDefault();
            isDrawing = false;
        }

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseleave', stopDrawing);

        canvas.addEventListener('touchstart', startDrawing);
        canvas.addEventListener('touchmove', draw);
        canvas.addEventListener('touchend', stopDrawing);
        canvas.addEventListener('touchcancel', stopDrawing);

        canvas._ctx = ctx;
    }

    window.limparAssinatura = function (tipo) {
        var canvasId = 'sigCanvas' + tipo.charAt(0).toUpperCase() + tipo.slice(1);
        var canvas = document.getElementById(canvasId);
        if (!canvas) return;

        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.beginPath();
        ctx.strokeStyle = '#e8eff5';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.moveTo(20, canvas.height / 2);
        ctx.lineTo(canvas.width - 20, canvas.height / 2);
        ctx.stroke();
        ctx.setLineDash([]);
    };

    window.salvarAssinatura = function (tipo) {
        if (!signatureOSId) {
            alert('Nenhuma OS selecionada!');
            return;
        }

        var canvasId = 'sigCanvas' + tipo.charAt(0).toUpperCase() + tipo.slice(1);
        var canvas = document.getElementById(canvasId);
        if (!canvas) return;

        var imageData = canvas.toDataURL('image/png');
        var img = new Image();
        img.onload = function () {
            var tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            var tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(img, 0, 0);

            var pixelData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
            var hasDrawing = false;

            for (var i = 0; i < pixelData.length; i += 4) {
                var r = pixelData[i];
                var g = pixelData[i + 1];
                var b = pixelData[i + 2];
                if (r < 240 || g < 240 || b < 240) {
                    hasDrawing = true;
                    break;
                }
            }

            if (!hasDrawing) {
                alert('Por favor, desenhe a assinatura antes de salvar!');
                return;
            }

            var os = DB.getById('ordens', signatureOSId);
            if (!os) {
                alert('OS não encontrada!');
                return;
            }

            var campo = tipo === 'operador' ? 'assinaturaOperador' : 'assinaturaCliente';
            DB.update('ordens', signatureOSId, { [campo]: imageData });

            alert('Assinatura salva com sucesso!');

            var wrapper = canvas.parentElement;
            var imgElement = wrapper.querySelector('.signature-image');
            if (imgElement) {
                imgElement.src = imageData;
                imgElement.style.display = 'block';
            }

            renderAll();
        };
        img.src = imageData;
    };

    window.removerAssinatura = function (osId, tipo) {
        if (!confirm('Remover a assinatura do ' + (tipo === 'operador' ? 'operador' : 'cliente') + '?')) {
            return;
        }

        var campo = tipo === 'operador' ? 'assinaturaOperador' : 'assinaturaCliente';
        DB.update('ordens', osId, { [campo]: null });

        fecharModal();
        setTimeout(function () {
            abrirAssinaturaOS(osId);
        }, 100);

        renderAll();
    };

    // =============================================
    // ===== FUNÇÃO PARA INICIALIZAR EVENT LISTENERS =====
    // =============================================
    function inicializarEventListeners() {
        // Botão Novo Relatório
        var btnNovoRelatorio = document.getElementById('btnNovoRelatorio');
        if (btnNovoRelatorio) {
            btnNovoRelatorio.addEventListener('click', function () {
                var modelos = DB.getAll('modelos');
                var clientes = DB.getAll('clientes');

                if (modelos.length === 0) {
                    alert('Crie um modelo de relatório primeiro!');
                    return;
                }
                if (clientes.length === 0) {
                    alert('Cadastre um cliente primeiro!');
                    return;
                }

                var hoje = new Date().toISOString().split('T')[0];

                abrirModal('Novo Relatório', `
                    <div class="form-group">
                        <label>Título do Relatório</label>
                        <input type="text" id="modalRelatorioTitulo" placeholder="Ex: Relatório de Não Conformidade - NC-001" />
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Cliente</label>
                            <select id="modalRelatorioCliente">
                                ${clientes.map(c => `<option value="${c.id}">${c.nome} (${c.tipoCliente === 'cnpj' ? 'CNPJ' : 'CPF'}: ${c.documento})</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Data</label>
                            <input type="date" id="modalRelatorioData" value="${hoje}" />
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Modelo</label>
                            <select id="modalRelatorioModelo">
                                ${modelos.map(m => `<option value="${m.id}">${m.nome}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="modalRelatorioStatus">
                                <option value="Pendente">Pendente</option>
                                <option value="Em andamento">Em andamento</option>
                                <option value="Concluído">Concluído</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Gravidade</label>
                        <select id="modalRelatorioGravidade">
                            <option value="Baixa">Baixa</option>
                            <option value="Média">Média</option>
                            <option value="Alta">Alta</option>
                            <option value="Crítica">Crítica</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Campos do Relatório</label>
                        <div id="relatorioCamposContainer"></div>
                    </div>
                    <div class="form-group">
                        <label>Observações</label>
                        <textarea id="modalRelatorioObs" rows="2" placeholder="Observações adicionais..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>Imagens (múltiplas)</label>
                        <input type="file" id="modalRelatorioImagens" accept="image/*" multiple style="padding:8px;" />
                        <div id="previewImagens" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="fecharModal()">Cancelar</button>
                        <button class="btn-primary" onclick="criarRelatorio()">Criar Relatório</button>
                    </div>
                `);

                var inputImagens = document.getElementById('modalRelatorioImagens');
                if (inputImagens) {
                    inputImagens.addEventListener('change', function () {
                        var preview = document.getElementById('previewImagens');
                        if (!preview) return;
                        preview.innerHTML = '';
                        if (this.files) {
                            Array.from(this.files).forEach(function (file, index) {
                                var reader = new FileReader();
                                reader.onload = function (e) {
                                    var div = document.createElement('div');
                                    div.style.cssText = 'position:relative;width:80px;height:80px;border:1px solid #e8eff5;border-radius:8px;overflow:hidden;';
                                    div.innerHTML = `
                                        <img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;" />
                                        <span style="position:absolute;bottom:0;right:0;background:rgba(0,0,0,0.7);color:white;font-size:10px;padding:2px 6px;border-radius:4px 0 0 0;">${index + 1}</span>
                                    `;
                                    preview.appendChild(div);
                                };
                                reader.readAsDataURL(file);
                            });
                        }
                    });
                }

                var elModelo = document.getElementById('modalRelatorioModelo');
                if (elModelo) {
                    elModelo.addEventListener('change', function () {
                        preencherCamposRelatorio(parseInt(this.value));
                    });
                    preencherCamposRelatorio(parseInt(elModelo.value));
                }
            });
        }

        // Botão Novo Ponto
        var btnNovoPonto = document.getElementById('btnNovoPonto');
        if (btnNovoPonto) {
            btnNovoPonto.addEventListener('click', function () {
                var clientes = DB.getAll('clientes');
                if (clientes.length === 0) {
                    alert('Cadastre um cliente primeiro!');
                    return;
                }

                abrirModal('Novo Ponto de Isca', `
                    <div class="form-group">
                        <label>Tipo</label>
                        <select id="modalPontoTipo">
                            <option value="porta-isca">Porta Isca</option>
                            <option value="tunel">Túnel</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Número do Ponto *</label>
                        <input type="text" id="modalPontoNome" placeholder="Ex: P-001, T-001" />
                    </div>
                    <div class="form-group">
                        <label>Cliente</label>
                        <select id="modalPontoCliente">
                            ${clientes.map(c => `<option value="${c.id}">${c.nome} (${c.tipoCliente === 'cnpj' ? 'CNPJ' : 'CPF'})</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Localização *</label>
                        <input type="text" id="modalPontoPosicao" placeholder="Ex: Canto esquerdo da parede, Prateleira A1" />
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Data de Instalação</label><input type="date" id="modalPontoInstalacao" /></div>
                    </div>
                    
                    <!-- Checkboxes de Manutenção e Instalação -->
                    <div class="form-row" style="margin-top:8px;">
                        <div class="form-group" style="display:flex;align-items:center;gap:8px;">
                            <input type="checkbox" id="modalPontoManutencaoCheck" style="width:20px;height:20px;cursor:pointer;" />
                            <label for="modalPontoManutencaoCheck" style="margin:0;font-weight:500;cursor:pointer;">🔧 Manutenção</label>
                        </div>
                        <div class="form-group" style="display:flex;align-items:center;gap:8px;">
                            <input type="checkbox" id="modalPontoInstalacaoCheck" style="width:20px;height:20px;cursor:pointer;" />
                            <label for="modalPontoInstalacaoCheck" style="margin:0;font-weight:500;cursor:pointer;">📦 Instalação</label>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Status</label>
                        <select id="modalPontoStatus">
                            <option value="ok">✅ Ok</option>
                            <option value="consumo">📦 Consumo</option>
                            <option value="danificado">⚠️ Danificado</option>
                            <option value="substituido">🔄 Substituído</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Observações</label>
                        <textarea id="modalPontoObs" rows="2" placeholder="Observações sobre o ponto..."></textarea>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="fecharModal()">Cancelar</button>
                        <button class="btn-primary" onclick="criarNovoPonto()">Criar Ponto</button>
                    </div>
                `);
            });
        }

        // =============================================
        // ===== BOTÃO NOVO SERVIÇO - MULTI-SELEÇÃO =====
        // =============================================
        var btnNovoServico = document.getElementById('btnNovoServico');
        if (btnNovoServico) {
            btnNovoServico.addEventListener('click', function () {
                var clientes = DB.getAll('clientes');
                if (clientes.length === 0) {
                    alert('Cadastre um cliente primeiro!');
                    return;
                }

                var hoje = new Date().toISOString().split('T')[0];
                var agora = new Date();
                var horarioAtual = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');

                abrirModal('Novo Serviço', `
                    <div class="modal-servico">
                        <div class="form-group">
                            <label>Cliente <span class="required">*</span></label>
                            <div class="input-icon-wrapper">
                                <i class="fas fa-user"></i>
                                <select id="modalClienteId">
                                    ${clientes.map(c => `<option value="${c.id}">${c.nome} (${c.tipoCliente === 'cnpj' ? 'CNPJ' : 'CPF'})</option>`).join('')}
                                </select>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Tipos de Serviço <span class="required">*</span></label>
                            <div class="servico-tipos" id="servicoTipos">
                                <div class="tipo-option selected" data-tipo="Desratização">
                                    <span class="icon">🐀</span>
                                    Desratização
                                    <span class="check-mark">✓</span>
                                </div>
                                <div class="tipo-option" data-tipo="Desinsetização">
                                    <span class="icon">🐜</span>
                                    Desinsetização
                                    <span class="check-mark">✓</span>
                                </div>
                                <div class="tipo-option" data-tipo="Descupinização">
                                    <span class="icon">🏠</span>
                                    Descupinização
                                    <span class="check-mark">✓</span>
                                </div>
                            </div>
                            <input type="hidden" id="modalTipos" value='["Desratização"]' />
                            <small style="color:#4d687a;display:block;margin-top:4px;">💡 Selecione um ou mais serviços para este atendimento</small>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Data do Serviço <span class="required">*</span></label>
                                <div class="input-icon-wrapper">
                                    <i class="fas fa-calendar-alt"></i>
                                    <input type="date" id="modalData" value="${hoje}" />
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Horário <span class="required">*</span></label>
                                <div class="input-icon-wrapper">
                                    <i class="fas fa-clock"></i>
                                    <input type="time" id="modalHorario" value="${horarioAtual}" />
                                </div>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Valor (R$)</label>
                                <div class="input-icon-wrapper">
                                    <i class="fas fa-dollar-sign"></i>
                                    <input type="number" id="modalValor" placeholder="0,00" step="0.01" min="0" />
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Status <span class="required">*</span></label>
                                <div class="servico-status" id="servicoStatus">
                                    <div class="status-option selected" data-status="Agendado">
                                        <span class="dot agendado"></span> Agendado
                                    </div>
                                    <div class="status-option" data-status="Em andamento">
                                        <span class="dot andamento"></span> Em andamento
                                    </div>
                                    <div class="status-option" data-status="Pendente">
                                        <span class="dot pendente"></span> Pendente
                                    </div>
                                    <div class="status-option" data-status="Concluído">
                                        <span class="dot concluido"></span> Concluído
                                    </div>
                                    <div class="status-option" data-status="Cancelado">
                                        <span class="dot cancelado"></span> Cancelado
                                    </div>
                                </div>
                                <input type="hidden" id="modalStatus" value="Agendado" />
                            </div>
                        </div>

                        <div class="servico-footer">
                            <button class="btn-cancel" onclick="fecharModal()">Cancelar</button>
                            <button class="btn-create" onclick="criarNovoServicoMulti()">
                                <i class="fas fa-plus-circle"></i> Criar Serviço
                            </button>
                        </div>
                    </div>
                `);

                // ===== CONFIGURA A MULTI-SELEÇÃO =====
                var servicoTipos = document.getElementById('servicoTipos');
                if (servicoTipos) {
                    var selectedTipos = ['Desratização'];
                    
                    servicoTipos.querySelectorAll('.tipo-option').forEach(function (el) {
                        el.addEventListener('click', function () {
                            var tipo = this.dataset.tipo;
                            var index = selectedTipos.indexOf(tipo);
                            
                            if (index === -1) {
                                selectedTipos.push(tipo);
                                this.classList.add('selected');
                            } else {
                                if (selectedTipos.length > 1) {
                                    selectedTipos.splice(index, 1);
                                    this.classList.remove('selected');
                                } else {
                                    alert('Selecione pelo menos um tipo de serviço!');
                                }
                            }
                            
                            var tiposInput = document.getElementById('modalTipos');
                            if (tiposInput) {
                                tiposInput.value = JSON.stringify(selectedTipos);
                            }
                        });
                    });
                }

                var servicoStatus = document.getElementById('servicoStatus');
                if (servicoStatus) {
                    servicoStatus.querySelectorAll('.status-option').forEach(function (el) {
                        el.addEventListener('click', function () {
                            servicoStatus.querySelectorAll('.status-option').forEach(function (o) { o.classList.remove('selected'); });
                            this.classList.add('selected');
                            var statusInput = document.getElementById('modalStatus');
                            if (statusInput) statusInput.value = this.dataset.status;
                        });
                    });
                }
            });
        }

        // =============================================
        // ===== CRIA NOVO SERVIÇO COM MÚLTIPLOS TIPOS =====
        // =============================================

        window.criarNovoServicoMulti = function () {
            var clienteId = parseInt(document.getElementById('modalClienteId')?.value || '0');
            var data = document.getElementById('modalData')?.value?.split('-').reverse().join('/') || '';
            var horario = document.getElementById('modalHorario')?.value || '09:00';
            var status = document.getElementById('modalStatus')?.value || 'Agendado';
            var valor = parseFloat(document.getElementById('modalValor')?.value) || 0;

            var tiposInput = document.getElementById('modalTipos');
            var tipos = [];
            try {
                tipos = JSON.parse(tiposInput?.value || '["Desratização"]');
            } catch (e) {
                tipos = ['Desratização'];
            }

            if (!clienteId || !data || tipos.length === 0) {
                alert('Preencha todos os campos obrigatórios e selecione pelo menos um tipo de serviço!');
                return;
            }

            var chaveAtendimento = clienteId + '_' + data + '_' + horario + '_' + Date.now();
            

            var servicosExistentes = DB.getAll('servicos');
            
            var servicoExistente = servicosExistentes.find(function (s) {
                if (String(s.clienteId) !== String(clienteId)) return false;
                if (s.data !== data) return false;
                if (s.status !== status && s.status !== 'Agendado') return false;
                
                var tiposExistentes = s.tipos || [s.tipo];
                if (tiposExistentes.length !== tipos.length) return false;
                var sorted1 = tiposExistentes.slice().sort();
                var sorted2 = tipos.slice().sort();
                return sorted1.every(function (t, i) { return t === sorted2[i]; });
            });

            if (servicoExistente) {
                console.warn('⚠️ Serviço já existe, atualizando em vez de criar novo:', servicoExistente.id);
                DB.update('servicos', servicoExistente.id, {
                    status: status,
                    valor: valor,
                    horario: horario,
                    atualizadoEm: new Date().toISOString()
                });

                sincronizarServicoMultiComAgenda(servicoExistente, 'update');
                sincronizarServicoMultiComOS(servicoExistente, 'update');

                fecharModal();
                renderAll();
                alert('✅ Serviço #' + String(servicoExistente.id).padStart(3, '0') + ' atualizado para: ' + status + ' (' + tipos.join(', ') + ')');
                return;
            }

            var servico = DB.add('servicos', {
                clienteId: clienteId,
                tipos: tipos,
                tipo: tipos[0],
                data: data,
                status: status,
                valor: valor,
                horario: horario,
                chaveAtendimento: chaveAtendimento,
                criadoEm: new Date().toISOString(),
                atualizadoEm: new Date().toISOString()
            });


            var cliente = getCliente(clienteId);
            var clienteNome = cliente ? cliente.nome : 'Cliente #' + clienteId;

            var statusMap = {
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
            var statusInfo = statusMap[status] || { emoji: '📌', label: status };
            var valorFormatado = valor ? valor.toFixed(2).replace('.', ',') : '0,00';
            var tiposStr = tipos.join(' + ');
            var descricao = 'Serviço #' + String(servico.id).padStart(3, '0') + ': ' + tiposStr + ' - ' + statusInfo.emoji + ' ' + statusInfo.label + ' (R$ ' + valorFormatado + ')';

            var agendaKey = DB.getFullKey('agenda');
            var agendaItems = JSON.parse(localStorage.getItem(agendaKey) || '[]');
            var agendamentoExistente = agendaItems.find(function (a) {
                return a.servicoId === servico.id;
            });

            if (agendamentoExistente) {
                console.warn('⚠️ Agendamento já existe para o serviço #' + servico.id + ', atualizando...');
                var index = agendaItems.findIndex(function (a) { return a.id === agendamentoExistente.id; });
                if (index !== -1) {
                    agendaItems[index] = {
                        ...agendamentoExistente,
                        data: data,
                        horario: horario,
                        descricao: descricao,
                        statusServico: status,
                        tiposServico: tipos,
                        tipoServico: tipos[0],
                        clienteNome: clienteNome,
                        atualizadoEm: new Date().toISOString()
                    };
                    localStorage.setItem(agendaKey, JSON.stringify(agendaItems));
                }
            } else {
                var maxId = agendaItems.reduce(function (max, a) {
                    var id = typeof a.id === 'number' ? a.id : parseInt(a.id) || 0;
                    return Math.max(max, id);
                }, 0);
                var novoId = maxId + 1;

                var novoAgendamento = {
                    id: novoId,
                    clienteId: clienteId,
                    data: data,
                    horario: horario,
                    descricao: descricao,
                    servicoId: servico.id,
                    statusServico: status,
                    tiposServico: tipos,
                    tipoServico: tipos[0],
                    sincronizado: true,
                    clienteNome: clienteNome,
                    criadoEm: new Date().toISOString(),
                    atualizadoEm: new Date().toISOString()
                };

                agendaItems.push(novoAgendamento);
                localStorage.setItem(agendaKey, JSON.stringify(agendaItems));
            }

            sincronizarServicoMultiComOS(servico, 'add');

            if (status === 'Concluído' || status === 'Concluida' || status === 'Concluída') {
                verificarCertificadoAutomaticoMulti(servico);
            }

            DB.forceClearCache('agenda');
            DB._clearAllCaches();

            fecharModal();
            renderAll();

            setTimeout(function () {
                renderAll();
            }, 200);

            alert('✅ Serviço #' + String(servico.id).padStart(3, '0') + ' criado com status: ' + status + ' (' + tipos.join(', ') + ')');
        };

        // =============================================
        // ===== SINCRONIZAÇÃO SERVIÇO MULTI ↔ OS =====
        // =============================================

        function sincronizarServicoMultiComOS(servico, acao) {
            if (!servico) return;

            var ordens = DB.getAll('ordens');
            var osVinculada = ordens.find(function (o) { return o.servicoId === servico.id; });

            var tipos = servico.tipos || [servico.tipo];
            var tiposStr = tipos.join(' + ');
            var valorServico = servico.valor || 0;

            if (acao === 'remove') {
                if (osVinculada) {
                    DB.update('ordens', osVinculada.id, {
                        servicoId: null,
                        status: 'Cancelada',
                        atualizadoEm: new Date().toISOString()
                    });
                }
                return;
            }

            var statusOS = mapearStatusServicoParaOS(servico.status);

            if (osVinculada) {
                var itensAtualizados = osVinculada.itens || [];
                
                if (itensAtualizados.length > 0) {
                    itensAtualizados[0] = Object.assign({}, itensAtualizados[0], {
                        valorUnitario: valorServico,
                        quantidade: 1,
                        descricao: 'Serviço: ' + tiposStr
                    });
                } else if (valorServico > 0) {
                    itensAtualizados = [{
                        descricao: 'Serviço: ' + tiposStr,
                        quantidade: 1,
                        valorUnitario: valorServico
                    }];
                }

                var valorTotal = itensAtualizados.reduce(function (sum, item) {
                    return sum + (item.quantidade * (item.valorUnitario || 0));
                }, 0);

                DB.update('ordens', osVinculada.id, {
                    clienteId: servico.clienteId,
                    data: servico.data,
                    status: statusOS,
                    valorTotal: valorTotal,
                    itens: itensAtualizados,
                    tiposServico: tipos,
                    atualizadoEm: new Date().toISOString()
                });
            } else if (acao === 'add' || acao === 'update') {
                var numeroOS = gerarNumeroOS();

                var itens = [];
                if (valorServico > 0) {
                    itens.push({
                        descricao: 'Serviço: ' + tiposStr,
                        quantidade: 1,
                        valorUnitario: valorServico
                    });
                }

                DB.add('ordens', {
                    numero: numeroOS,
                    clienteId: servico.clienteId,
                    data: servico.data,
                    status: statusOS,
                    servicoId: servico.id,
                    itens: itens,
                    valorTotal: valorServico,
                    tiposServico: tipos,
                    observacoes: 'OS gerada automaticamente para serviços: ' + tiposStr + ' (#' + String(servico.id).padStart(3, '0') + ')',
                    areaLiberada: '',
                    dataEntrega: '',
                    assinaturaOperador: null,
                    assinaturaCliente: null,
                    garantia: '',
                    criadoEm: new Date().toISOString(),
                    atualizadoEm: new Date().toISOString()
                });
            }
        }

        // =============================================
        // ===== SINCRONIZAÇÃO SERVIÇO MULTI ↔ AGENDA =====
        // =============================================

        function sincronizarServicoMultiComAgenda(servico, acao, servicoAntigo) {
            if (!servico) return;


            var cliente = getCliente(servico.clienteId);
            var clienteNome = cliente ? cliente.nome : 'Cliente #' + servico.clienteId;
            var tipos = servico.tipos || [servico.tipo];
            var tiposStr = tipos.join(' + ');

            var statusMap = {
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

            var statusInfo = statusMap[servico.status] || { emoji: '📌', label: servico.status };
            var statusEmoji = statusInfo.emoji;
            var statusLabel = statusInfo.label;
            var valorFormatado = servico.valor ? servico.valor.toFixed(2).replace('.', ',') : '0,00';
            var descricao = 'Serviço #' + String(servico.id).padStart(3, '0') + ': ' + tiposStr + ' - ' + statusEmoji + ' ' + statusLabel + ' (R$ ' + valorFormatado + ')';

            var agendaKey = DB.getFullKey('agenda');
            var agendaItems = JSON.parse(localStorage.getItem(agendaKey) || '[]');
            var agendamentoExistente = agendaItems.find(function (a) {
                return a.servicoId === servico.id;
            });


            if (agendamentoExistente) {
                var horario = servico.horario || agendamentoExistente.horario || '09:00';
                var index = agendaItems.findIndex(function (a) {
                    return a.id === agendamentoExistente.id;
                });

                if (index !== -1) {
                    agendaItems[index] = {
                        id: agendamentoExistente.id,
                        clienteId: servico.clienteId,
                        data: servico.data,
                        horario: horario,
                        descricao: descricao,
                        servicoId: servico.id,
                        statusServico: servico.status,
                        tiposServico: tipos,
                        tipoServico: tipos[0],
                        sincronizado: true,
                        clienteNome: clienteNome,
                        criadoEm: agendamentoExistente.criadoEm || new Date().toISOString(),
                        atualizadoEm: new Date().toISOString()
                    };

                    localStorage.setItem(agendaKey, JSON.stringify(agendaItems));
                    DB.forceClearCache('agenda');
                    return agendaItems[index];
                }
            }

            if (acao === 'remove') {
                if (agendamentoExistente) {
                    var filteredItems = agendaItems.filter(function (a) {
                        return a.servicoId !== servico.id;
                    });
                    localStorage.setItem(agendaKey, JSON.stringify(filteredItems));
                    DB.forceClearCache('agenda');
                }
                return;
            }

            if (acao === 'add' || (acao === 'update' && !agendamentoExistente)) {
                var horarioBase = servico.horario || '09:00';
                var maxId = agendaItems.reduce(function (max, a) {
                    var id = typeof a.id === 'number' ? a.id : parseInt(a.id) || 0;
                    return Math.max(max, id);
                }, 0);
                var novoId = maxId + 1;

                var novoAgendamento = {
                    id: novoId,
                    clienteId: servico.clienteId,
                    data: servico.data,
                    horario: horarioBase,
                    descricao: descricao,
                    servicoId: servico.id,
                    statusServico: servico.status,
                    tiposServico: tipos,
                    tipoServico: tipos[0],
                    sincronizado: true,
                    clienteNome: clienteNome,
                    criadoEm: new Date().toISOString(),
                    atualizadoEm: new Date().toISOString()
                };

                agendaItems.push(novoAgendamento);
                localStorage.setItem(agendaKey, JSON.stringify(agendaItems));
                DB.forceClearCache('agenda');
                return novoAgendamento;
            }
        }

        // =============================================
        // ===== CERTIFICADO AUTOMÁTICO MULTI =====
        // =============================================

        function verificarCertificadoAutomaticoMulti(servico) {
            if (!servico) return;

            if (servico.status === 'Concluído' || servico.status === 'Concluida' || servico.status === 'Concluída') {
                const certificados = CertificadoService.listarCertificados();
                const existe = certificados.some(c => String(c.servicoId) === String(servico.id));

                if (!existe) {
                    try {
                        const tipos = servico.tipos || [servico.tipo];
                        const tipoPrincipal = tipos.length > 0 ? tipos[0] : servico.tipo || 'Desinsetização';
                        
                        const certificado = CertificadoService.gerarCertificado(servico.id, tipoPrincipal);
                        
                        if (certificado && tipos.length > 1) {
                            DB.update('certificados', certificado.id, {
                                tiposServico: tipos,
                                descricaoCompleta: tipos.join(' + ')
                            });
                            
                            setTimeout(() => {
                                const certAtualizado = CertificadoService.getCertificado(certificado.id);
                                if (certAtualizado) {
                                }
                            }, 100);
                        }
                        
                        return certificado;
                    } catch (error) {
                        console.warn('Erro ao gerar certificado automático:', error);
                    }
                }
            }
            return null;
        }

        // =============================================
        // ===== FUNÇÃO DE EDIÇÃO DE SERVIÇO =====
        // =============================================

        window.editarServico = function (id) {
            var s = DB.getById('servicos', id);
            if (!s) return;

            var validade = calcularValidadeServico(s);
            var infoValidade = '';
            if (validade) {
                var statusMap = {
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

            var horarioAtual = '09:00';
            var agendaKey = DB.getFullKey('agenda');
            var agendaItems = JSON.parse(localStorage.getItem(agendaKey) || '[]');
            var agendamento = agendaItems.find(function (a) { return a.servicoId === id; });
            if (agendamento) {
                horarioAtual = agendamento.horario || '09:00';
            }

            var tipos = s.tipos || [s.tipo];
            var tiposHtml = tipos.map(function(t) {
                return '<span style="background:#e8eff5;padding:2px 12px;border-radius:12px;font-size:0.85rem;color:#1f3a4b;margin:2px;">' + t + '</span>';
            }).join('');

            abrirModal('Editar Serviço', `
                ${infoValidade}
                <div class="form-group">
                    <label>Cliente</label>
                    <select id="modalClienteId">
                        ${DB.getAll('clientes').map(c => `<option value="${c.id}" ${c.id === s.clienteId ? 'selected' : ''}>${c.nome} (${c.tipoCliente === 'cnpj' ? 'CNPJ' : 'CPF'})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Tipos de Serviço</label>
                    <div style="display:flex;flex-wrap:wrap;gap:8px;padding:8px 12px;background:#f8fbfd;border-radius:8px;border:1px solid #e8eff5;">
                        ${tiposHtml}
                    </div>
                    <small style="color:#4d687a;font-size:0.8rem;display:block;margin-top:4px;">Para editar os tipos, recrie o serviço ou use a opção de múltipla seleção.</small>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Data</label><input type="date" id="modalData" value="${s.data.split('/').reverse().join('-')}" /></div>
                    <div class="form-group"><label>Horário</label><input type="time" id="modalHorario" value="${horarioAtual}" /></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Valor (R$)</label><input type="number" id="modalValor" value="${s.valor || 0}" step="0.01" /></div>
                    <div class="form-group"><label>Status</label>
                        <select id="modalStatus">
                            ${['Concluído', 'Em andamento', 'Pendente', 'Agendado', 'Cancelado'].map(st => `<option value="${st}" ${st === s.status ? 'selected' : ''}>${st}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <small style="color:#4d687a;font-size:0.8rem;display:block;margin-top:4px;">⚠️ Alterar o status atualizará automaticamente a agenda e a OS vinculada.</small>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="fecharModal()">Cancelar</button>
                    <button class="btn-primary" onclick="salvarEdicaoServicoMulti(${id})">Salvar</button>
                </div>
            `);
        };

        // =============================================
        // ===== SALVAR EDIÇÃO DE SERVIÇO MULTI =====
        // =============================================

        window.salvarEdicaoServicoMulti = function (id) {
            var clienteId = parseInt(document.getElementById('modalClienteId')?.value || '0');
            var data = document.getElementById('modalData')?.value?.split('-').reverse().join('/') || '';
            var horario = document.getElementById('modalHorario')?.value || '09:00';
            var status = document.getElementById('modalStatus')?.value || 'Agendado';
            var valor = parseFloat(document.getElementById('modalValor')?.value) || 0;

            var servicoAntigo = DB.getById('servicos', id);
            if (!servicoAntigo) {
                alert('Serviço não encontrado!');
                return;
            }

            var tipos = servicoAntigo.tipos || [servicoAntigo.tipo];


            DB.update('servicos', id, {
                clienteId: clienteId,
                data: data,
                status: status,
                valor: valor,
                horario: horario,
                tipos: tipos,
                atualizadoEm: new Date().toISOString()
            });

            var servicoAtualizado = DB.getById('servicos', id);

            sincronizarServicoMultiComAgenda(servicoAtualizado, 'update', servicoAntigo);

            sincronizarServicoMultiComOS(servicoAtualizado, 'update');

            if (status === 'Concluído' || status === 'Concluida' || status === 'Concluída') {
                verificarCertificadoAutomaticoMulti(servicoAtualizado);
            }

            DB.forceClearCache('agenda');
            DB._clearAllCaches();

            fecharModal();
            renderAll();

            setTimeout(function () {
                renderAll();
            }, 300);

            alert('✅ Serviço #' + String(id).padStart(3, '0') + ' atualizado para: ' + status + ' (' + tipos.join(', ') + ')');
        };

        // =============================================
        // ===== EXCLUIR SERVIÇO =====
        // =============================================

        window.excluirServico = function (id) {
            if (!confirm('Tem certeza que deseja excluir este serviço?')) {
                return;
            }

            var servico = DB.getById('servicos', id);
            if (!servico) return;

            var agendaKey = DB.getFullKey('agenda');
            var agenda = JSON.parse(localStorage.getItem(agendaKey) || '[]');
            var agendamentoRelacionado = agenda.find(function (a) { return a.servicoId === id; });
            if (agendamentoRelacionado) {
                var novaAgenda = agenda.filter(function (a) { return a.id !== agendamentoRelacionado.id; });
                localStorage.setItem(agendaKey, JSON.stringify(novaAgenda));
            }

            var ordens = DB.getAll('ordens');
            var osRelacionada = ordens.find(function (o) { return o.servicoId === id; });
            if (osRelacionada) {
                DB.update('ordens', osRelacionada.id, {
                    servicoId: null,
                    status: 'Cancelada',
                    atualizadoEm: new Date().toISOString()
                });
            }

            DB.remove('servicos', id);
            DB._clearAllCaches();
            DB.forceClearCache('agenda');
            renderAll();

            setTimeout(function () {
                renderAll();
            }, 200);

            alert('✅ Serviço removido com sucesso!');
        };

        // Botão Novo Proposta Comercial
        var btnNovoOrcamento = document.getElementById('btnNovoOrcamento');
        if (btnNovoOrcamento) {
            btnNovoOrcamento.addEventListener('click', function () {
                var clientes = DB.getAll('clientes');
                if (clientes.length === 0) {
                    alert('Cadastre um cliente primeiro!');
                    return;
                }

                var numero = gerarNumeroOrcamento();
                var hoje = new Date().toISOString().split('T')[0];
                var config = DB.getConfig();

                abrirModal('Nova Proposta', `
                    <div class="form-group">
                        <label>N° da Proposta Comercial</label>
                        <input type="text" id="modalOrcNumero" value="${numero}" style="font-weight:600;background:#f0f4f8;" />
                    </div>
                    <div class="form-group">
                        <label>Cliente *</label>
                        <select id="modalOrcCliente">
                            ${clientes.map(c => `<option value="${c.id}">${c.nome} (${c.documento || 'N/A'})</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Data da Proposta *</label>
                            <input type="date" id="modalOrcData" value="${hoje}" />
                        </div>
                        <div class="form-group">
                            <label>Validade (dias)</label>
                            <input type="number" id="modalOrcValidade" value="15" min="1" />
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Título da Proposta</label>
                        <input type="text" id="modalOrcTitulo" value=" Proposta Comercial" />
                    </div>
                    <div class="form-group">
                        <label>Mensagem de Agradecimento</label>
                        <textarea id="modalOrcMensagem" rows="2">Agradecemos pela oportunidade de apresentar nossa proposta. Estamos à disposição para esclarecer quaisquer dúvidas.</textarea>
                    </div>
                    <h4 style="margin:16px 0 8px;color:#0b2a3b;">Itens da Proposta</h4>
                    <div id="orcItensContainer">
                        <div class="orc-item-row" style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:10px;align-items:end;margin-bottom:8px;">
                            <div class="form-group" style="margin-bottom:0;">
                                <label>Descrição do Serviço</label>
                                <input type="text" class="orc-descricao" value=" " />
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label>Qtd</label>
                                <input type="number" class="orc-quantidade" value="1" min="1" />
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label>Valor Unit. (R$)</label>
                                <input type="number" class="orc-valor-unitario" value="0" step="0.01" min="0" />
                            </div>
                            <div style="display:flex;align-items:center;padding-bottom:6px;">
                                <button type="button" class="btn-danger btn-sm" onclick="removerItemOrcamento(this)"><i class="fas fa-times"></i></button>
                            </div>
                        </div>
                    </div>
                    <button type="button" class="btn-secondary btn-sm" onclick="adicionarItemOrcamento()" style="margin-top:4px;">
                        <i class="fas fa-plus"></i> Adicionar Item
                    </button>
                    <div class="form-row" style="margin-top:12px;">
                        <div class="form-group">
                            <label>Desconto (R$)</label>
                            <input type="number" id="modalOrcDesconto" value="0" step="0.01" min="0" />
                        </div>
                        <div class="form-group">
                            <label>Taxa Adicional (R$)</label>
                            <input type="number" id="modalOrcTaxa" value="0" step="0.01" min="0" />
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Observações / Condições</label>
                        <textarea id="modalOrcObs" rows="2">Condições de pagamento: 50% na contratação e 50% após a execução do serviço.</textarea>
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <select id="modalOrcStatus">
                            <option value="Rascunho">Rascunho</option>
                            <option value="Enviado">Enviado</option>
                            <option value="Aprovado">Aprovado</option>
                            <option value="Rejeitado">Rejeitado</option>
                        </select>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="fecharModal()">Cancelar</button>
                        <button class="btn-primary" onclick="criarNovoOrcamento()">Criar Proposta</button>
                    </div>
                `);
            });
        }

        // Botão Novo Cliente
        var btnNovoCliente = document.getElementById('btnNovoCliente');
        if (btnNovoCliente) {
            btnNovoCliente.addEventListener('click', function () {
                abrirModal('Novo Cliente', `
                    <div class="form-group">
                        <label id="labelNome">Nome *</label>
                        <input type="text" id="modalNome" placeholder="Nome completo" />
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Tipo de Cliente *</label>
                            <select id="modalTipoCliente" onchange="toggleDocumentoCliente(); toggleCamposCnpj();">
                                <option value="cpf">Pessoa Física (CPF)</option>
                                <option value="cnpj">Pessoa Jurídica (CNPJ)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label id="labelDocumento">CPF *</label>
                            <input type="text" id="modalDocumento" placeholder="000.000.000-00" maxlength="14" />
                        </div>
                    </div>
                    <div id="camposCnpj" style="display:none;">
                        <div class="form-group">
                            <label>Razão Social *</label>
                            <input type="text" id="modalRazaoSocial" placeholder="Razão Social da empresa" />
                        </div>
                        <div class="form-group">
                            <label>Nome Fantasia</label>
                            <input type="text" id="modalNomeFantasia" placeholder="Nome Fantasia da empresa" />
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Telefone</label>
                        <input type="text" id="modalTelefone" placeholder="(11) 99999-9999" />
                    </div>
                    <div class="form-group">
                        <label>Endereço</label>
                        <input type="text" id="modalEndereco" placeholder="Rua, número, bairro, cidade - UF" />
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="fecharModal()">Cancelar</button>
                        <button class="btn-primary" onclick="criarNovoCliente()">Criar</button>
                    </div>
                `);

                setTimeout(function () {
                    var input = document.getElementById('modalDocumento');
                    if (input) {
                        input.addEventListener('input', function (e) {
                            aplicarMascaraDocumento(e.target);
                        });
                    }

                    toggleCamposCnpj();
                }, 100);
            });
        }

        // Botão Novo Membro
        var btnNovoMembro = document.getElementById('btnNovoMembro');
        if (btnNovoMembro) {
            btnNovoMembro.addEventListener('click', function () {
                abrirModal('Adicionar Membro', `
                    <div class="form-group"><label>Nome</label><input type="text" id="modalNomeMembro" /></div>
                    <div class="form-group"><label>Cargo</label>
                        <select id="modalCargoMembro">
                            ${['Técnico Sênior', 'Técnico', 'Técnica Especialista', 'Coordenador', 'Suporte', 'Estagiário'].map(c => `<option value="${c}">${c}</option>`).join('')}
                        </select>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="fecharModal()">Cancelar</button>
                        <button class="btn-primary" onclick="criarNovoMembro()">Adicionar</button>
                    </div>
                `);
            });
        }

        // Botão Novo Produto
        var btnNovoProduto = document.getElementById('btnNovoProduto');
        if (btnNovoProduto) {
            btnNovoProduto.addEventListener('click', function () {
                var hoje = new Date().toISOString().split('T')[0];
                var nextId = DB.getAll('estoque').length + 1;
                var codigo = 'PROD-' + String(nextId).padStart(3, '0');

                abrirModal('Novo Produto', `
                    <div class="form-row">
                        <div class="form-group">
                            <label>Código</label>
                            <input type="text" id="modalProdutoCodigo" value="${codigo}" />
                        </div>
                        <div class="form-group">
                            <label>Nome do Produto *</label>
                            <input type="text" id="modalProdutoNome" placeholder="Ex: Isca Gel" />
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Categoria *</label>
                            <select id="modalProdutoCategoria">
                                <option value="Inseticidas">Inseticidas</option>
                                <option value="Rodenticidas">Rodenticidas</option>
                                <option value="Equipamentos">Equipamentos</option>
                                <option value="EPI">EPI</option>
                                <option value="Outros">Outros</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Unidade *</label>
                            <select id="modalProdutoUnidade">
                                <option value="un">Unidade</option>
                                <option value="kg">Quilograma</option>
                                <option value="g">Grama</option>
                                <option value="l">Litro</option>
                                <option value="ml">Mililitro</option>
                                <option value="par">Par</option>
                                <option value="cx">Caixa</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Quantidade Inicial</label>
                            <input type="number" id="modalProdutoQtd" value="0" min="0" />
                        </div>
                        <div class="form-group">
                            <label>Estoque Mínimo *</label>
                            <input type="number" id="modalProdutoMinimo" value="10" min="0" />
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Valor de Custo (R$)</label>
                            <input type="number" id="modalProdutoCusto" value="0" step="0.01" min="0" />
                        </div>
                        <div class="form-group">
                            <label>Valor de Venda (R$)</label>
                            <input type="number" id="modalProdutoVenda" value="0" step="0.01" min="0" />
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Localização</label>
                        <input type="text" id="modalProdutoLocalizacao" placeholder="Ex: Prateleira A1" />
                    </div>
                    <div class="form-group">
                        <label>Fornecedor</label>
                        <input type="text" id="modalProdutoFornecedor" placeholder="Nome do fornecedor" />
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="fecharModal()">Cancelar</button>
                        <button class="btn-primary" onclick="criarProduto()">Criar Produto</button>
                    </div>
                `);
            });
        }

        // Botão Entrada Estoque
        var btnEntradaEstoque = document.getElementById('btnEntradaEstoque');
        if (btnEntradaEstoque) {
            btnEntradaEstoque.addEventListener('click', function () {
                var produtos = DB.getAll('estoque');
                if (produtos.length === 0) {
                    alert('Cadastre um produto primeiro!');
                    return;
                }

                abrirModal('Entrada Rápida', `
                    <div class="form-group">
                        <label>Produto</label>
                        <select id="modalMovProduto">
                            ${produtos.map(p => `<option value="${p.id}">${p.codigo} - ${p.nome} (${p.quantidade} ${p.unidade})</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Quantidade</label>
                        <input type="number" id="modalMovQtdRapida" value="1" min="1" />
                    </div>
                    <div class="form-group">
                        <label>Observação</label>
                        <input type="text" id="modalMovObsRapida" placeholder="Ex: NF-1234" />
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="fecharModal()">Cancelar</button>
                        <button class="btn-primary" onclick="confirmarEntradaRapida()">Confirmar Entrada</button>
                    </div>
                `);
            });
        }

        // Botão Saída Estoque
        var btnSaidaEstoque = document.getElementById('btnSaidaEstoque');
        if (btnSaidaEstoque) {
            btnSaidaEstoque.addEventListener('click', function () {
                var produtos = DB.getAll('estoque');
                if (produtos.length === 0) {
                    alert('Cadastre um produto primeiro!');
                    return;
                }

                abrirModal('Saída Rápida', `
                    <div class="form-group">
                        <label>Produto</label>
                        <select id="modalMovProdutoSaida">
                            ${produtos.map(p => `<option value="${p.id}">${p.codigo} - ${p.nome} (${p.quantidade} ${p.unidade})</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Quantidade</label>
                        <input type="number" id="modalMovQtdSaida" value="1" min="1" />
                    </div>
                    <div class="form-group">
                        <label>Motivo</label>
                        <select id="modalMovMotivoSaida">
                            <option value="OS">Ordem de Serviço</option>
                            <option value="Consumo">Consumo Interno</option>
                            <option value="Devolução">Devolução ao Fornecedor</option>
                            <option value="Ajuste">Ajuste de Estoque</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Observação</label>
                        <input type="text" id="modalMovObsSaida" placeholder="Ex: OS-001" />
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="fecharModal()">Cancelar</button>
                        <button class="btn-primary" style="background:#b13e3a;" onclick="confirmarSaidaRapida()">Confirmar Saída</button>
                    </div>
                `);
            });
        }

        // Botão Novo Certificado
        var btnNovoCert = document.getElementById('btnNovoCertificado');
        if (btnNovoCert) {
            btnNovoCert.addEventListener('click', abrirNovoCertificado);
        }

        // Botão Logout
        var logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function () {
                if (confirm('Deseja realmente sair?')) {
                    if (this._loggingOut) return;
                    this._loggingOut = true;

                    try {
                        if (typeof AuthService !== 'undefined') {
                            const empresaAtual = AuthService.getEmpresaAtual();
                            AuthService.logout(empresaAtual);
                        } else {
                            localStorage.removeItem('dedetiza_session');
                            if (typeof EmpresaManager !== 'undefined') {
                                const empresaAtual = EmpresaManager.getEmpresaAtual();
                                EmpresaManager.removerSessao(empresaAtual);
                            }
                            window.location.href = 'login.html';
                        }
                    } catch (error) {
                        console.error('Erro ao sair:', error);
                        localStorage.removeItem('dedetiza_session');
                        window.location.href = 'login.html';
                    } finally {
                        this._loggingOut = false;
                    }
                }
            });
        }

        // Menu Toggle
        var menuToggle = document.getElementById('menuToggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', toggleSidebar);
        }
    }

    // =============================================
    // ===== BOTÃO GERENCIAR ASSINATURAS =====
    // =============================================

    document.addEventListener('DOMContentLoaded', function () {
        const toolbarCert = document.querySelector('#page-certificados .toolbar');
        if (toolbarCert) {
            const existingBtn = toolbarCert.querySelector('.btn-gerenciar-assinaturas');
            if (!existingBtn) {
                const btnGerenciarAssinaturas = document.createElement('button');
                btnGerenciarAssinaturas.className = 'btn-secondary btn-sm btn-gerenciar-assinaturas';
                btnGerenciarAssinaturas.style.marginLeft = '8px';
                btnGerenciarAssinaturas.innerHTML = '<i class="fas fa-signature"></i> Gerenciar Assinaturas';
                btnGerenciarAssinaturas.onclick = window.abrirGerenciadorAssinaturas;
                toolbarCert.appendChild(btnGerenciarAssinaturas);
            }
        }
    });

    // =============================================
    // ===== FUNÇÃO RENDERIZAR TABELA ESTOQUE =====
    // =============================================
    function renderizarTabelaEstoque(produtos) {
        var tbody = document.getElementById('tabelaEstoque');
        if (!tbody) return;

        if (!produtos) {
            produtos = DB.getAll('estoque', true);
        }

        if (produtos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#999;padding:30px;">Nenhum produto cadastrado</td></tr>';
            return;
        }

        tbody.innerHTML = produtos.map(function (p) {
            var statusClass = p.quantidade <= 0 ? 'critico' :
                p.quantidade <= p.minimo ? 'baixo' :
                    p.quantidade >= p.minimo * 3 ? 'alto' : 'normal';
            var statusText = p.quantidade <= 0 ? '⚠️ Esgotado' :
                p.quantidade <= p.minimo ? '⚠️ Baixo' :
                    p.quantidade >= p.minimo * 3 ? '✅ Alto' : '✅ Normal';

            return '<tr>' +
                '<td><strong>' + p.codigo + '</strong></td>' +
                '<td>' + p.nome + '</td>' +
                '<td>' + p.categoria + '</td>' +
                '<td><strong>' + p.quantidade + '</strong> ' + p.unidade + '</td>' +
                '<td>' + p.minimo + '</td>' +
                '<td><span class="status-badge ' + statusClass + '">' + statusText + '</span></td>' +
                '<td>' + (p.localizacao || 'N/A') + '</td>' +
                '<td>' +
                '<i class="fas fa-eye" onclick="verDetalhesProduto(' + p.id + ')" title="Detalhes" style="color:#1d7a6b;"></i>' +
                '<i class="fas fa-edit" onclick="editarProduto(' + p.id + ')" title="Editar"></i>' +
                '<i class="fas fa-arrow-down" onclick="movimentarEstoque(' + p.id + ', \'entrada\')" title="Entrada" style="color:#1d7a6b;"></i>' +
                '<i class="fas fa-arrow-up" onclick="movimentarEstoque(' + p.id + ', \'saida\')" title="Saída" style="color:#b13e3a;"></i>' +
                '<i class="fas fa-trash" onclick="excluirProduto(' + p.id + ')" title="Excluir" style="color:#b13e3a;"></i>' +
                '</td>' +
                '</tr>';
        }).join('');

        atualizarDashboardEstoque();
    }

    // =============================================
    // ===== RENDER ESTOQUE =====
    // =============================================
    function renderEstoque() {
        var produtos = DB.getAll('estoque', true);
        renderizarTabelaEstoque(produtos);
    }

    // =============================================
    // ===== FUNÇÕES DE ESTOQUE =====
    // =============================================

    window.criarProduto = function () {
        var codigo = document.getElementById('modalProdutoCodigo')?.value || '';
        var nome = document.getElementById('modalProdutoNome')?.value || '';
        var categoria = document.getElementById('modalProdutoCategoria')?.value || 'Outros';
        var unidade = document.getElementById('modalProdutoUnidade')?.value || 'un';
        var quantidade = parseInt(document.getElementById('modalProdutoQtd')?.value) || 0;
        var minimo = parseInt(document.getElementById('modalProdutoMinimo')?.value) || 0;
        var valorCusto = parseFloat(document.getElementById('modalProdutoCusto')?.value) || 0;
        var valorVenda = parseFloat(document.getElementById('modalProdutoVenda')?.value) || 0;
        var localizacao = document.getElementById('modalProdutoLocalizacao')?.value || '';
        var fornecedor = document.getElementById('modalProdutoFornecedor')?.value || '';

        if (!nome) {
            alert('Nome do produto é obrigatório!');
            return;
        }

        var hoje = new Date().toLocaleDateString('pt-BR');

        var produto = {
            codigo: codigo,
            nome: nome,
            categoria: categoria,
            unidade: unidade,
            quantidade: quantidade,
            minimo: minimo,
            valorCusto: valorCusto,
            valorVenda: valorVenda,
            localizacao: localizacao,
            fornecedor: fornecedor,
            dataCadastro: hoje,
            ultimaMovimentacao: hoje
        };

        var newProduto = DB.add('estoque', produto);

        if (quantidade > 0) {
            var mov = {
                produtoId: newProduto.id,
                tipo: 'entrada',
                quantidade: quantidade,
                data: new Date().toLocaleString('pt-BR'),
                motivo: 'Cadastro inicial',
                observacao: 'Produto cadastrado no sistema',
                usuario: 'Admin',
                estoqueAnterior: 0,
                estoqueAtual: quantidade
            };
            DB.add('movimentacoes', mov);
        }

        DB.forceClearCache('estoque');
        DB.forceClearCache('movimentacoes');

        fecharModal();

        var produtosAtualizados = DB.getAll('estoque', true);
        renderizarTabelaEstoque(produtosAtualizados);
        atualizarDashboardEstoque();
        atualizarGraficosEstoque();

        setTimeout(function () {
            renderAll();
        }, 50);

        alert('✅ Produto "' + nome + '" criado com sucesso!');
    };

    // =============================================
    // ===== FUNÇÕES DE MAPA DE ISCAS =====
    // =============================================

    window.criarNovoPonto = function () {
        var tipo = document.getElementById('modalPontoTipo')?.value || 'porta-isca';
        var numero = document.getElementById('modalPontoNome')?.value || '';
        var clienteId = parseInt(document.getElementById('modalPontoCliente')?.value || '0');
        var localizacao = document.getElementById('modalPontoPosicao')?.value || '';
        var dataInstalacao = document.getElementById('modalPontoInstalacao')?.value?.split('-').reverse().join('/') || '';
        var status = document.getElementById('modalPontoStatus')?.value || 'ok';
        var observacoes = document.getElementById('modalPontoObs')?.value || '';

        var manutencao = document.getElementById('modalPontoManutencaoCheck')?.checked || false;
        var instalacao = document.getElementById('modalPontoInstalacaoCheck')?.checked || false;

        if (!numero || !localizacao) {
            alert('Número do Ponto e Localização são obrigatórios!');
            return;
        }

        var newPonto = DB.add('pontosIscas', {
            tipo: tipo,
            numero: numero,
            clienteId: clienteId,
            localizacao: localizacao,
            dataInstalacao: dataInstalacao,
            status: status,
            observacoes: observacoes,
            manutencao: manutencao,
            instalacao: instalacao
        });

        fecharModal();

        DB.forceClearCache('pontosIscas');
        renderMapaComFiltros();
        preencherFiltrosClientesMapa();

        document.dispatchEvent(new CustomEvent('pontoIscaAtualizado', {
            detail: { item: newPonto, action: 'add' }
        }));

        alert('Ponto de isca criado com sucesso!');
    };

    window.editarPontoIsca = function (id) {
        var p = DB.getById('pontosIscas', id);
        if (!p) return;

        var clientes = DB.getAll('clientes');

        var manutencaoChecked = p.manutencao ? 'checked' : '';
        var instalacaoChecked = p.instalacao ? 'checked' : '';

        abrirModal('Editar Ponto de Isca', `
            <div class="form-group">
                <label>Tipo</label>
                <select id="modalPontoTipo">
                    <option value="porta-isca" ${p.tipo === 'porta-isca' ? 'selected' : ''}>Porta Isca</option>
                    <option value="tunel" ${p.tipo === 'tunel' ? 'selected' : ''}>Túnel</option>
                </select>
            </div>
            <div class="form-group">
                <label>Número do Ponto *</label>
                <input type="text" id="modalPontoNome" value="${p.numero || p.nome || ''}" />
            </div>
            <div class="form-group">
                <label>Cliente</label>
                <select id="modalPontoCliente">
                    ${clientes.map(c => `<option value="${c.id}" ${c.id === p.clienteId ? 'selected' : ''}>${c.nome} (${c.tipoCliente === 'cnpj' ? 'CNPJ' : 'CPF'})</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Localização *</label>
                <input type="text" id="modalPontoPosicao" value="${p.localizacao || p.posicao || ''}" />
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Data de Instalação</label>
                    <input type="date" id="modalPontoInstalacao" value="${p.dataInstalacao ? p.dataInstalacao.split('/').reverse().join('-') : ''}" />
                </div>
            </div>
            
            <div class="form-row" style="margin-top:8px;">
                <div class="form-group" style="display:flex;align-items:center;gap:8px;">
                    <input type="checkbox" id="modalPontoManutencaoCheck" ${manutencaoChecked} style="width:20px;height:20px;cursor:pointer;" />
                    <label for="modalPontoManutencaoCheck" style="margin:0;font-weight:500;cursor:pointer;">🔧 Manutenção</label>
                </div>
                <div class="form-group" style="display:flex;align-items:center;gap:8px;">
                    <input type="checkbox" id="modalPontoInstalacaoCheck" ${instalacaoChecked} style="width:20px;height:20px;cursor:pointer;" />
                    <label for="modalPontoInstalacaoCheck" style="margin:0;font-weight:500;cursor:pointer;">📦 Instalação</label>
                </div>
            </div>
            
            <div class="form-group">
                <label>Status</label>
                <select id="modalPontoStatus">
                    <option value="ok" ${p.status === 'ok' ? 'selected' : ''}>✅ Ok</option>
                    <option value="consumo" ${p.status === 'consumo' ? 'selected' : ''}>📦 Consumo</option>
                    <option value="danificado" ${p.status === 'danificado' ? 'selected' : ''}>⚠️ Danificado</option>
                    <option value="substituido" ${p.status === 'substituido' ? 'selected' : ''}>🔄 Substituído</option>
                </select>
            </div>
            <div class="form-group">
                <label>Observações</label>
                <textarea id="modalPontoObs" rows="2">${p.observacoes || ''}</textarea>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="fecharModal()">Cancelar</button>
                <button class="btn-primary" onclick="salvarEdicaoPonto(${id})">Salvar</button>
            </div>
        `);
    };

    window.salvarEdicaoPonto = function (id) {
        var tipo = document.getElementById('modalPontoTipo')?.value || 'porta-isca';
        var numero = document.getElementById('modalPontoNome')?.value || '';
        var clienteId = parseInt(document.getElementById('modalPontoCliente')?.value || '0');
        var localizacao = document.getElementById('modalPontoPosicao')?.value || '';
        var dataInstalacao = document.getElementById('modalPontoInstalacao')?.value?.split('-').reverse().join('/') || '';
        var status = document.getElementById('modalPontoStatus')?.value || 'ok';
        var observacoes = document.getElementById('modalPontoObs')?.value || '';

        var manutencao = document.getElementById('modalPontoManutencaoCheck')?.checked || false;
        var instalacao = document.getElementById('modalPontoInstalacaoCheck')?.checked || false;

        if (!numero || !localizacao) {
            alert('Número do Ponto e Localização são obrigatórios!');
            return;
        }

        DB.update('pontosIscas', id, {
            tipo: tipo,
            numero: numero,
            clienteId: clienteId,
            localizacao: localizacao,
            dataInstalacao: dataInstalacao,
            status: status,
            observacoes: observacoes,
            manutencao: manutencao,
            instalacao: instalacao
        });

        fecharModal();

        DB.forceClearCache('pontosIscas');
        renderMapaComFiltros();
        preencherFiltrosClientesMapa();

        alert('Ponto atualizado com sucesso!');
    };

    window.excluirPontoIsca = function (id) {
        if (confirm('Tem certeza que deseja excluir este ponto de isca?')) {
            DB.remove('pontosIscas', id);
            DB.forceClearCache('pontosIscas');
            renderMapaComFiltros();
            preencherFiltrosClientesMapa();
        }
    };

    window.alternarStatusPonto = function (id) {
        var p = DB.getById('pontosIscas', id);
        if (!p) return;

        var statusMap = {
            'ok': 'consumo',
            'consumo': 'danificado',
            'danificado': 'substituido',
            'substituido': 'ok'
        };
        var novoStatus = statusMap[p.status] || 'ok';

        DB.update('pontosIscas', id, { status: novoStatus });
        DB.forceClearCache('pontosIscas');
        renderMapaComFiltros();
    };

    // =============================================
    // ===== FILTROS PARA MAPA DE ISCAS =====
    // =============================================

    var filtrosMapa = {
        clienteId: '',
        tipo: '',
        status: '',
        busca: ''
    };

    function preencherFiltrosClientesMapa() {
        var clientes = DB.getAll('clientes');
        var selectMapa = document.getElementById('filtroMapaCliente');
        if (selectMapa) {
            var currentValue = selectMapa.value;
            selectMapa.innerHTML = '<option value="">Todos os Clientes</option>' +
                clientes.map(c => `<option value="${c.id}">${c.nome} (${c.documento || 'N/A'})</option>`).join('');
            selectMapa.value = currentValue;
        }
    }

    window.aplicarFiltrosMapa = function () {
        var clienteId = document.getElementById('filtroMapaCliente')?.value || '';
        var tipo = document.getElementById('filtroMapaTipo')?.value || '';
        var status = document.getElementById('filtroMapaStatus')?.value || '';
        var busca = document.getElementById('filtroMapaBusca')?.value || '';

        filtrosMapa.clienteId = clienteId;
        filtrosMapa.tipo = tipo;
        filtrosMapa.status = status;
        filtrosMapa.busca = busca.toLowerCase();

        renderMapaComFiltros();
    };

    window.limparFiltrosMapa = function () {
        document.getElementById('filtroMapaCliente').value = '';
        document.getElementById('filtroMapaTipo').value = '';
        document.getElementById('filtroMapaStatus').value = '';
        document.getElementById('filtroMapaBusca').value = '';

        filtrosMapa.clienteId = '';
        filtrosMapa.tipo = '';
        filtrosMapa.status = '';
        filtrosMapa.busca = '';

        renderMapaComFiltros();
    };

    function renderMapaComFiltros() {
        DB.forceClearCache('pontosIscas');

        var pontos = DB.getAll('pontosIscas', true);
        var container = document.getElementById('mapaGrid');
        if (!container) return;

        var temFiltroAtivo = filtrosMapa.clienteId || filtrosMapa.tipo || filtrosMapa.status;

        if (!temFiltroAtivo) {
            var hoje = new Date().toLocaleDateString('pt-BR');
            pontos = pontos.filter(function (p) {
                return p.dataInstalacao === hoje;
            });
        }

        var filtrados = pontos.filter(function (p) {
            if (filtrosMapa.clienteId) {
                if (String(p.clienteId) !== String(filtrosMapa.clienteId)) return false;
            }
            if (filtrosMapa.tipo) {
                if (p.tipo !== filtrosMapa.tipo) return false;
            }
            if (filtrosMapa.status) {
                if (p.status !== filtrosMapa.status) return false;
            }
            if (filtrosMapa.busca) {
                var cliente = getCliente(p.clienteId);
                var clienteNome = cliente ? cliente.nome.toLowerCase() : '';
                var searchFields = [
                    (p.numero || p.nome || '').toLowerCase(),
                    (p.localizacao || p.posicao || '').toLowerCase(),
                    clienteNome,
                    (p.observacoes || '').toLowerCase()
                ];
                var found = searchFields.some(function (field) {
                    return field.indexOf(filtrosMapa.busca) !== -1;
                });
                if (!found) return false;
            }
            return true;
        });

        var resultados = temFiltroAtivo ? filtrados : pontos;

        if (resultados.length === 0) {
            container.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#999;padding:40px;">' +
                (temFiltroAtivo ? 'Nenhum ponto de isca encontrado com os filtros aplicados' : 'Nenhum ponto de isca cadastrado para hoje') +
                '</div>';
            return;
        }

        var statusMap = {
            'ok': { label: '✅ Ok', class: 'ok' },
            'consumo': { label: '📦 Consumo', class: 'consumo' },
            'danificado': { label: '⚠️ Danificado', class: 'danificado' },
            'substituido': { label: '🔄 Substituído', class: 'substituido' }
        };

        container.innerHTML = resultados.map(function (p) {
            var cliente = getCliente(p.clienteId);
            var statusInfo = statusMap[p.status] || statusMap['ok'];
            var numeroDisplay = p.numero || p.nome || 'N/A';
            var localizacaoDisplay = p.localizacao || p.posicao || 'N/A';

            var manutencaoIcon = p.manutencao ? '🔧' : '';
            var instalacaoIcon = p.instalacao ? '📦' : '';
            var statusIcons = [manutencaoIcon, instalacaoIcon].filter(icon => icon).join(' ');

            return '<div class="mapa-card">' +
                '<div class="card-header">' +
                '<div class="info">' +
                '<div class="tipo-icon">' +
                getTipoIcon(p.tipo) +
                '<span style="font-size:0.8rem;color:#4d687a;margin-left:4px;">' + (p.tipo === 'porta-isca' ? 'Porta Isca' : 'Túnel') + '</span>' +
                '</div>' +
                '<h3>#' + numeroDisplay + ' ' + statusIcons + '</h3>' +
                '<div class="localizacao"><i class="fas fa-map-pin" style="color:#1d7a6b;"></i> ' + localizacaoDisplay + '</div>' +
                '<div style="font-size:0.85rem;color:#4d687a;margin-top:4px;">' +
                '<i class="fas fa-user"></i> ' + (cliente ? cliente.nome : 'N/A') +
                '</div>' +
                '</div>' +
                '<div class="status-badge">' +
                '<span class="' + statusInfo.class + '">' + statusInfo.label + '</span>' +
                '</div>' +
                '</div>' +
                '<div class="card-body">' +
                '<div class="detalhe"><i class="fas fa-calendar-plus"></i> Inst: ' + (p.dataInstalacao || 'N/A') + '</div>' +
                (p.manutencao ? '<div class="detalhe" style="background:#fff2d0;"><i class="fas fa-tools"></i> Manutenção</div>' : '') +
                (p.instalacao ? '<div class="detalhe" style="background:#d1f0e5;"><i class="fas fa-box"></i> Instalação</div>' : '') +
                '</div>' +
                (p.observacoes ? '<div style="margin-top:8px;font-size:0.85rem;color:#4d687a;background:#f8fbfd;padding:8px 12px;border-radius:8px;"><i class="fas fa-comment"></i> ' + p.observacoes + '</div>' : '') +
                '<div class="card-actions">' +
                '<i class="fas fa-edit" onclick="editarPontoIsca(' + p.id + ')" title="Editar"></i>' +
                '<i class="fas fa-trash" onclick="excluirPontoIsca(' + p.id + ')" title="Excluir"></i>' +
                '<i class="fas fa-check-circle" onclick="alternarStatusPonto(' + p.id + ')" title="Alternar Status" style="color:#1d7a6b;"></i>' +
                '</div>' +
                '</div>';
        }).join('');
    }

    // =============================================
    // ===== TOGGLE SIDEBAR =====
    // =============================================
    var sidebar = document.getElementById('sidebar');
    var sidebarOverlay = document.getElementById('sidebarOverlay');
    var sidebarOpen = window.innerWidth > 820;

    function toggleSidebar() {
        if (!sidebar) return;

        if (window.innerWidth <= 820) {
            sidebar.classList.toggle('open');
            if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
            sidebarOpen = sidebar.classList.contains('open');
        } else {
            if (sidebar.style.width === '80px' || sidebar.style.width === '') {
                sidebar.style.width = '260px';
                sidebarOpen = true;
                document.querySelectorAll('.brand span, .nav-menu ul li span, .sidebar-footer span').forEach(function (s) {
                    if (s) s.style.display = 'inline';
                });
            } else {
                sidebar.style.width = '80px';
                sidebarOpen = false;
                document.querySelectorAll('.brand span, .nav-menu ul li span, .sidebar-footer span').forEach(function (s) {
                    if (s) s.style.display = 'none';
                });
            }
        }
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function () {
            if (window.innerWidth <= 820 && sidebar) {
                sidebar.classList.remove('open');
                sidebarOverlay.classList.remove('active');
                sidebarOpen = false;
            }
        });
    }

    document.querySelectorAll('.nav-menu ul li').forEach(function (li) {
        li.addEventListener('click', function () {
            if (window.innerWidth <= 820 && sidebar) {
                sidebar.classList.remove('open');
                if (sidebarOverlay) sidebarOverlay.classList.remove('active');
                sidebarOpen = false;
            }
        });
    });

    window.addEventListener('resize', function () {
        if (!sidebar) return;

        if (window.innerWidth > 820) {
            sidebar.classList.remove('open');
            if (sidebarOverlay) sidebarOverlay.classList.remove('active');
            sidebar.style.width = '260px';
            sidebarOpen = true;
            document.querySelectorAll('.brand span, .nav-menu ul li span, .sidebar-footer span').forEach(function (s) {
                if (s) s.style.display = 'inline';
            });
        } else {
            sidebar.style.width = '';
            if (!sidebarOpen) {
                sidebar.classList.remove('open');
                if (sidebarOverlay) sidebarOverlay.classList.remove('active');
            }
        }
    });

    // =============================================
    // ===== FILTROS PARA SERVIÇOS =====
    // =============================================

    var filtrosServicos = {
        dataInicio: '',
        dataFim: '',
        clienteId: '',
        tipo: '',
        status: ''
    };

    function preencherFiltrosClientes() {
        var clientes = DB.getAll('clientes');

        var selectServicos = document.getElementById('filtroServicosCliente');
        if (selectServicos) {
            var currentValue = selectServicos.value;
            selectServicos.innerHTML = '<option value="">Todos os Clientes</option>' +
                clientes.map(c => `<option value="${c.id}">${c.nome} (${c.documento || 'N/A'})</option>`).join('');
            selectServicos.value = currentValue;
        }

        var selectOS = document.getElementById('filtroOSCliente');
        if (selectOS) {
            var currentValueOS = selectOS.value;
            selectOS.innerHTML = '<option value="">Todos os Clientes</option>' +
                clientes.map(c => `<option value="${c.id}">${c.nome} (${c.documento || 'N/A'})</option>`).join('');
            selectOS.value = currentValueOS;
        }

        var selectAgenda = document.getElementById('filtroAgendaCliente');
        if (selectAgenda) {
            var currentValueAgenda = selectAgenda.value;
            selectAgenda.innerHTML = '<option value="">Todos os Clientes</option>' +
                clientes.map(c => `<option value="${c.id}">${c.nome} (${c.documento || 'N/A'})</option>`).join('');
            selectAgenda.value = currentValueAgenda;
        }

        var selectMapa = document.getElementById('filtroMapaCliente');
        if (selectMapa) {
            var currentValueMapa = selectMapa.value;
            selectMapa.innerHTML = '<option value="">Todos os Clientes</option>' +
                clientes.map(c => `<option value="${c.id}">${c.nome} (${c.documento || 'N/A'})</option>`).join('');
            selectMapa.value = currentValueMapa;
        }

        var selectFinanceiro = document.getElementById('filtroFinanceiroCliente');
        if (selectFinanceiro) {
            var currentValueFinanceiro = selectFinanceiro.value;
            selectFinanceiro.innerHTML = '<option value="">Todos os Clientes</option>' +
                clientes.map(c => `<option value="${c.id}">${c.nome} (${c.documento || 'N/A'})</option>`).join('');
            selectFinanceiro.value = currentValueFinanceiro;
        }
    }

    window.aplicarFiltrosServicos = function () {
        var dataInicio = document.getElementById('filtroServicosDataInicio')?.value || '';
        var dataFim = document.getElementById('filtroServicosDataFim')?.value || '';
        var clienteId = document.getElementById('filtroServicosCliente')?.value || '';
        var tipo = document.getElementById('filtroServicosTipo')?.value || '';
        var status = document.getElementById('filtroServicosStatus')?.value || '';

        filtrosServicos.dataInicio = dataInicio;
        filtrosServicos.dataFim = dataFim;
        filtrosServicos.clienteId = clienteId;
        filtrosServicos.tipo = tipo;
        filtrosServicos.status = status;

        renderServicosComFiltros();
    };

    window.limparFiltrosServicos = function () {
        document.getElementById('filtroServicosDataInicio').value = '';
        document.getElementById('filtroServicosDataFim').value = '';
        document.getElementById('filtroServicosCliente').value = '';
        document.getElementById('filtroServicosTipo').value = '';
        document.getElementById('filtroServicosStatus').value = '';

        filtrosServicos.dataInicio = '';
        filtrosServicos.dataFim = '';
        filtrosServicos.clienteId = '';
        filtrosServicos.tipo = '';
        filtrosServicos.status = '';

        renderServicosComFiltros();
    };

    function renderServicosComFiltros() {
        var servicos = DB.getAll('servicos');
        var tbody = document.getElementById('tabelaServicos');
        if (!tbody) return;

        var temFiltroAtivo = filtrosServicos.dataInicio || filtrosServicos.dataFim ||
            filtrosServicos.clienteId || filtrosServicos.tipo || filtrosServicos.status;

        if (!temFiltroAtivo) {
            var hoje = new Date().toLocaleDateString('pt-BR');
            servicos = servicos.filter(function (s) {
                return s.data === hoje;
            });
        }

        var filtrados = servicos.filter(function (s) {
            if (filtrosServicos.dataInicio) {
                var partes = s.data.split('/');
                var dataServico = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataInicio = new Date(filtrosServicos.dataInicio);
                if (dataServico < dataInicio) return false;
            }
            if (filtrosServicos.dataFim) {
                var partes = s.data.split('/');
                var dataServico = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataFim = new Date(filtrosServicos.dataFim);
                dataFim.setHours(23, 59, 59);
                if (dataServico > dataFim) return false;
            }
            if (filtrosServicos.clienteId) {
                if (String(s.clienteId) !== String(filtrosServicos.clienteId)) return false;
            }
            if (filtrosServicos.tipo) {
                var tipos = s.tipos || [s.tipo];
                if (!tipos.includes(filtrosServicos.tipo)) return false;
            }
            if (filtrosServicos.status) {
                if (s.status !== filtrosServicos.status) return false;
            }
            return true;
        });

        var resultados = temFiltroAtivo ? filtrados : servicos;

        if (resultados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;padding:30px;">' +
                (temFiltroAtivo ? 'Nenhum serviço encontrado com os filtros aplicados' : 'Nenhum serviço agendado para hoje') +
                '</td></tr>';
            return;
        }

        tbody.innerHTML = resultados.map(function (s) {
            var validadeBadge = getValidadeBadge(s);
            var clienteNome = getClienteNome(s.clienteId);
            var tiposDisplay = s.tipos && s.tipos.length > 0 ? s.tipos.join(' + ') : s.tipo;
            return '<tr>' +
                '<td>#' + String(s.id).padStart(3, '0') + '</td>' +
                '<td>' + clienteNome + '</td>' +
                '<td>' + tiposDisplay + '</td>' +
                '<td>' + s.data + '</td>' +
                '<td>' + getStatusBadge(s.status) + '</td>' +
                '<td>' + validadeBadge + '</td>' +
                '<td>' +
                '<i class="fas fa-eye" onclick="editarServico(' + s.id + ')" title="Visualizar/Editar"></i>' +
                '<i class="fas fa-trash" onclick="excluirServico(' + s.id + ')" title="Excluir" style="color:#b13e3a;"></i>' +
                '</td>' +
                '</tr>';
        }).join('');
    }

    // =============================================
    // ===== FILTROS PARA PROPOSTAS =====
    // =============================================

    var filtrosOrcamentos = {
        clienteId: '',
        status: '',
        dataInicio: '',
        dataFim: ''
    };

    function preencherFiltrosOrcamentos() {
        var clientes = DB.getAll('clientes');
        var selectOrc = document.getElementById('filtroOrcCliente');
        if (selectOrc) {
            var currentValue = selectOrc.value;
            selectOrc.innerHTML = '<option value="">Todos os Clientes</option>' +
                clientes.map(c => `<option value="${c.id}">${c.nome} (${c.documento || 'N/A'})</option>`).join('');
            selectOrc.value = currentValue;
        }
    }

    window.aplicarFiltrosOrcamentos = function () {
        var clienteId = document.getElementById('filtroOrcCliente')?.value || '';
        var status = document.getElementById('filtroOrcStatus')?.value || '';
        var dataInicio = document.getElementById('filtroOrcDataInicio')?.value || '';
        var dataFim = document.getElementById('filtroOrcDataFim')?.value || '';

        filtrosOrcamentos.clienteId = clienteId;
        filtrosOrcamentos.status = status;
        filtrosOrcamentos.dataInicio = dataInicio;
        filtrosOrcamentos.dataFim = dataFim;

        renderOrcamentosComFiltros();
    };

    window.limparFiltrosOrcamentos = function () {
        document.getElementById('filtroOrcCliente').value = '';
        document.getElementById('filtroOrcStatus').value = '';
        document.getElementById('filtroOrcDataInicio').value = '';
        document.getElementById('filtroOrcDataFim').value = '';

        filtrosOrcamentos.clienteId = '';
        filtrosOrcamentos.status = '';
        filtrosOrcamentos.dataInicio = '';
        filtrosOrcamentos.dataFim = '';

        renderOrcamentosComFiltros();
    };

    function renderOrcamentosComFiltros() {
        var orcamentos = DB.getAll('orcamentos');
        var tbody = document.getElementById('tabelaOrcamentos');
        if (!tbody) return;

        var temFiltroAtivo = filtrosOrcamentos.clienteId || filtrosOrcamentos.status ||
            filtrosOrcamentos.dataInicio || filtrosOrcamentos.dataFim;

        if (!temFiltroAtivo) {
            var hoje = new Date().toLocaleDateString('pt-BR');
            orcamentos = orcamentos.filter(function (o) {
                return o.data === hoje;
            });
        }

        var filtrados = orcamentos.filter(function (o) {
            if (filtrosOrcamentos.clienteId) {
                if (String(o.clienteId) !== String(filtrosOrcamentos.clienteId)) return false;
            }
            if (filtrosOrcamentos.status) {
                if (o.status !== filtrosOrcamentos.status) return false;
            }
            if (filtrosOrcamentos.dataInicio) {
                var dataOrc = new Date(o.data.split('/').reverse().join('-'));
                var dataInicio = new Date(filtrosOrcamentos.dataInicio);
                if (dataOrc < dataInicio) return false;
            }
            if (filtrosOrcamentos.dataFim) {
                var dataOrc = new Date(o.data.split('/').reverse().join('-'));
                var dataFim = new Date(filtrosOrcamentos.dataFim);
                dataFim.setHours(23, 59, 59);
                if (dataOrc > dataFim) return false;
            }
            return true;
        });

        var resultados = temFiltroAtivo ? filtrados : orcamentos;

        if (resultados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;padding:30px;">' +
                (temFiltroAtivo ? 'Nenhuma Proposta encontrado com os filtros aplicados' : 'Nenhuma proposta criado hoje') +
                '</td></tr>';
            return;
        }

        tbody.innerHTML = resultados.map(function (o) {
            var total = o.itens ? o.itens.reduce(function (sum, item) {
                return sum + (item.quantidade * (item.valorUnitario || 0));
            }, 0) : 0;
            total = total - (o.desconto || 0) + (o.taxa || 0);
            var clienteNome = getClienteNome(o.clienteId);
            return '<tr>' +
                '<td><strong>' + o.numero + '</strong></td>' +
                '<td>' + clienteNome + '</td>' +
                '<td>' + o.data + '</td>' +
                '<td>' + formatCurrency(total) + '</td>' +
                '<td>' + getStatusBadge(o.status) + '</td>' +
                '<td>' +
                '<i class="fas fa-eye" onclick="visualizarOrcamento(' + o.id + ')" title="Visualizar" style="color:#1d7a6b;"></i>' +
                '<i class="fas fa-edit" onclick="editarOrcamento(' + o.id + ')" title="Editar"></i>' +
                '<i class="fas fa-file-pdf" onclick="enviarOrcamentoPDF(' + o.id + ')" title="Enviar PDF" style="color:#c0392b;"></i>' +
                '<i class="fas fa-trash" onclick="excluirOrcamento(' + o.id + ')" title="Excluir" style="color:#b13e3a;"></i>' +
                '</td>' +
                '</tr>';
        }).join('');
    }

    // =============================================
    // ===== FUNÇÕES DE PROPOSTAS =====
    // =============================================

    window.adicionarItemOrcamento = function () {
        var container = document.getElementById('orcItensContainer');
        if (!container) return;

        var div = document.createElement('div');
        div.className = 'orc-item-row';
        div.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:10px;align-items:end;margin-bottom:8px;';
        div.innerHTML = `
            <div class="form-group" style="margin-bottom:0;">
                <label>Descrição</label>
                <input type="text" class="orc-descricao" value="Novo Serviço" />
            </div>
            <div class="form-group" style="margin-bottom:0;">
                <label>Qtd</label>
                <input type="number" class="orc-quantidade" value="1" min="1" />
            </div>
            <div class="form-group" style="margin-bottom:0;">
                <label>Valor Unit. (R$)</label>
                <input type="number" class="orc-valor-unitario" value="0" step="0.01" min="0" />
            </div>
            <div style="display:flex;align-items:center;padding-bottom:6px;">
                <button type="button" class="btn-danger btn-sm" onclick="removerItemOrcamento(this)"><i class="fas fa-times"></i></button>
            </div>
        `;
        container.appendChild(div);
    };

    window.removerItemOrcamento = function (btn) {
        var row = btn?.closest('.orc-item-row');
        if (row && document.querySelectorAll('.orc-item-row').length > 1) {
            row.remove();
        } else {
            alert('Mantenha pelo menos um item.');
        }
    };

    window.criarNovoOrcamento = function () {
        var numero = document.getElementById('modalOrcNumero')?.value || gerarNumeroOrcamento();
        var clienteId = parseInt(document.getElementById('modalOrcCliente')?.value || '0');
        var data = document.getElementById('modalOrcData')?.value?.split('-').reverse().join('/') || '';
        var validade = parseInt(document.getElementById('modalOrcValidade')?.value) || 15;
        var titulo = document.getElementById('modalOrcTitulo')?.value || 'Proposta de Serviços';
        var mensagem = document.getElementById('modalOrcMensagem')?.value || '';
        var desconto = parseFloat(document.getElementById('modalOrcDesconto')?.value) || 0;
        var taxa = parseFloat(document.getElementById('modalOrcTaxa')?.value) || 0;
        var observacoes = document.getElementById('modalOrcObs')?.value || '';
        var status = document.getElementById('modalOrcStatus')?.value || 'Rascunho';

        if (!clienteId || !data) {
            alert('Preencha os campos obrigatórios: Cliente e Data!');
            return;
        }

        var itens = [];
        document.querySelectorAll('.orc-item-row').forEach(function (row) {
            var descricao = row.querySelector('.orc-descricao')?.value || '';
            var quantidade = parseFloat(row.querySelector('.orc-quantidade')?.value) || 1;
            var valorUnitario = parseFloat(row.querySelector('.orc-valor-unitario')?.value) || 0;
            if (descricao && quantidade > 0) {
                itens.push({ descricao: descricao, quantidade: quantidade, valorUnitario: valorUnitario });
            }
        });

        if (itens.length === 0) {
            alert('Adicione pelo menos um item a Proposta!');
            return;
        }

        var total = itens.reduce(function (sum, item) {
            return sum + (item.quantidade * (item.valorUnitario || 0));
        }, 0);

        var orcamento = {
            numero: numero,
            clienteId: clienteId,
            data: data,
            validade: validade,
            titulo: titulo,
            mensagem: mensagem,
            itens: itens,
            desconto: desconto,
            taxa: taxa,
            total: total,
            totalFinal: total - desconto + taxa,
            observacoes: observacoes,
            status: status,
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString()
        };

        DB.add('orcamentos', orcamento);
        DB.forceClearCache('orcamentos');

        if (typeof FirestoreService !== 'undefined') {
            try {
                FirestoreService._clearLocalCache('orcamentos');
            } catch (e) { }
        }

        fecharModal();

        setTimeout(function () {
            renderAll();
        }, 150);

        alert('Proposta ' + numero + ' criado com sucesso!');
    };

    window.editarOrcamento = function (id) {
        var o = DB.getById('orcamentos', id);
        if (!o) return;

        var clientes = DB.getAll('clientes');
        var itensHtml = o.itens.map(function (item, index) {
            return '<div class="orc-item-row" style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:10px;align-items:end;margin-bottom:8px;">' +
                '<div class="form-group" style="margin-bottom:0;">' +
                '<label>Descrição</label>' +
                '<input type="text" class="orc-descricao" value="' + (item.descricao || '') + '" />' +
                '</div>' +
                '<div class="form-group" style="margin-bottom:0;">' +
                '<label>Qtd</label>' +
                '<input type="number" class="orc-quantidade" value="' + (item.quantidade || 1) + '" min="1" />' +
                '</div>' +
                '<div class="form-group" style="margin-bottom:0;">' +
                '<label>Valor Unit. (R$)</label>' +
                '<input type="number" class="orc-valor-unitario" value="' + (item.valorUnitario || 0) + '" step="0.01" min="0" />' +
                '</div>' +
                '<div style="display:flex;align-items:center;padding-bottom:6px;">' +
                '<button type="button" class="btn-danger btn-sm" onclick="removerItemOrcamento(this)"><i class="fas fa-times"></i></button>' +
                '</div>' +
                '</div>';
        }).join('');

        abrirModal('Editar Proposta ' + o.numero, `
            <div class="form-group">
                <label>Número da Proposta</label>
                <input type="text" id="modalOrcNumero" value="${o.numero}" style="font-weight:600;background:#f0f4f8;" />
            </div>
            <div class="form-group">
                <label>Cliente *</label>
                <select id="modalOrcCliente">
                    ${clientes.map(c => `<option value="${c.id}" ${c.id === o.clienteId ? 'selected' : ''}>${c.nome} (${c.documento || 'N/A'})</option>`).join('')}
                </select>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Data da Proposta *</label>
                    <input type="date" id="modalOrcData" value="${o.data.split('/').reverse().join('-')}" />
                </div>
                <div class="form-group">
                    <label>Validade (dias)</label>
                    <input type="number" id="modalOrcValidade" value="${o.validade || 15}" min="1" />
                </div>
            </div>
            <div class="form-group">
                <label>Título da Proposta</label>
                <input type="text" id="modalOrcTitulo" value="${o.titulo || 'Proposta Comercial'}" />
            </div>
            <div class="form-group">
                <label>Mensagem de Agradecimento</label>
                <textarea id="modalOrcMensagem" rows="2">${o.mensagem || 'Agradecemos pela oportunidade de apresentar nossa proposta.'}</textarea>
            </div>
            <h4 style="margin:16px 0 8px;color:#0b2a3b;">Itens da Proposta</h4>
            <div id="orcItensContainer">
                ${itensHtml}
            </div>
            <button type="button" class="btn-secondary btn-sm" onclick="adicionarItemOrcamento()" style="margin-top:4px;">
                <i class="fas fa-plus"></i> Adicionar Item
            </button>
            <div class="form-row" style="margin-top:12px;">
                <div class="form-group">
                    <label>Desconto (R$)</label>
                    <input type="number" id="modalOrcDesconto" value="${o.desconto || 0}" step="0.01" min="0" />
                </div>
                <div class="form-group">
                    <label>Taxa Adicional (R$)</label>
                    <input type="number" id="modalOrcTaxa" value="${o.taxa || 0}" step="0.01" min="0" />
                </div>
            </div>
            <div class="form-group">
                <label>Observações / Condições</label>
                <textarea id="modalOrcObs" rows="2">${o.observacoes || ''}</textarea>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="modalOrcStatus">
                    <option value="Rascunho" ${o.status === 'Rascunho' ? 'selected' : ''}>Rascunho</option>
                    <option value="Enviado" ${o.status === 'Enviado' ? 'selected' : ''}>Enviado</option>
                    <option value="Aprovado" ${o.status === 'Aprovado' ? 'selected' : ''}>Aprovado</option>
                    <option value="Rejeitado" ${o.status === 'Rejeitado' ? 'selected' : ''}>Rejeitado</option>
                </select>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="fecharModal()">Cancelar</button>
                <button class="btn-primary" onclick="salvarEdicaoOrcamento(${id})">Salvar</button>
            </div>
        `);
    };

    window.salvarEdicaoOrcamento = function (id) {
        var numero = document.getElementById('modalOrcNumero')?.value || '';
        var clienteId = parseInt(document.getElementById('modalOrcCliente')?.value || '0');
        var data = document.getElementById('modalOrcData')?.value?.split('-').reverse().join('/') || '';
        var validade = parseInt(document.getElementById('modalOrcValidade')?.value) || 15;
        var titulo = document.getElementById('modalOrcTitulo')?.value || '';
        var mensagem = document.getElementById('modalOrcMensagem')?.value || '';
        var desconto = parseFloat(document.getElementById('modalOrcDesconto')?.value) || 0;
        var taxa = parseFloat(document.getElementById('modalOrcTaxa')?.value) || 0;
        var observacoes = document.getElementById('modalOrcObs')?.value || '';
        var status = document.getElementById('modalOrcStatus')?.value || 'Rascunho';

        if (!clienteId || !data) {
            alert('Preencha os campos obrigatórios: Cliente e Data!');
            return;
        }

        var itens = [];
        document.querySelectorAll('.orc-item-row').forEach(function (row) {
            var descricao = row.querySelector('.orc-descricao')?.value || '';
            var quantidade = parseFloat(row.querySelector('.orc-quantidade')?.value) || 1;
            var valorUnitario = parseFloat(row.querySelector('.orc-valor-unitario')?.value) || 0;
            if (descricao && quantidade > 0) {
                itens.push({ descricao: descricao, quantidade: quantidade, valorUnitario: valorUnitario });
            }
        });

        if (itens.length === 0) {
            alert('Adicione pelo menos um item a Proposta!');
            return;
        }

        var total = itens.reduce(function (sum, item) {
            return sum + (item.quantidade * (item.valorUnitario || 0));
        }, 0);

        DB.update('orcamentos', id, {
            numero: numero,
            clienteId: clienteId,
            data: data,
            validade: validade,
            titulo: titulo,
            mensagem: mensagem,
            itens: itens,
            desconto: desconto,
            taxa: taxa,
            total: total,
            totalFinal: total - desconto + taxa,
            observacoes: observacoes,
            status: status,
            atualizadoEm: new Date().toISOString()
        });

        DB.forceClearCache('orcamentos');
        fecharModal();

        setTimeout(function () {
            renderAll();
        }, 150);

        alert('Proposta atualizado com sucesso!');
    };

    window.excluirOrcamento = function (id) {
        if (confirm('Tem certeza que deseja excluir esta Proposta?')) {
            DB.remove('orcamentos', id);
            renderAll();
            alert('Proposta excluído com sucesso!');
        }
    };

    window.visualizarOrcamento = function (id) {
        var idNum = parseInt(id);
        if (isNaN(idNum)) {
            alert('ID da Proposta inválido!');
            return;
        }

        var o = DB.getById('orcamentos', idNum);
        if (!o) {
            console.error('Proposta não encontrado! ID:', id, 'Tipo:', typeof id);
            alert('Proposta não encontrado!');
            return;
        }

        var cliente = getCliente(o.clienteId);
        var config = DB.getConfig();

        var itensHtml = o.itens.map(function (item) {
            var subtotal = item.quantidade * (item.valorUnitario || 0);
            return '<tr>' +
                '<td style="padding:6px 10px;border-bottom:1px solid #e8eff5;">' + item.descricao + '</td>' +
                '<td style="padding:6px 10px;border-bottom:1px solid #e8eff5;text-align:center;">' + item.quantidade + '</td>' +
                '<td style="padding:6px 10px;border-bottom:1px solid #e8eff5;text-align:right;">' + formatCurrency(item.valorUnitario || 0) + '</td>' +
                '<td style="padding:6px 10px;border-bottom:1px solid #e8eff5;text-align:right;font-weight:600;">' + formatCurrency(subtotal) + '</td>' +
                '</tr>';
        }).join('');

        var total = o.total || 0;
        var totalFinal = o.totalFinal || total;

        var overlay = document.getElementById('modalOrcamentoOverlay');
        var titleEl = document.getElementById('modalOrcamentoTitle');
        var bodyEl = document.getElementById('modalOrcamentoBody');

        if (overlay) overlay.classList.add('active');
        if (titleEl) titleEl.textContent = 'Proposta ' + o.numero;
        if (bodyEl) {
            bodyEl.innerHTML = `
                <div style="font-family: Arial, sans-serif; padding: 10px 0;">
                    <div style="text-align:center;border-bottom:2px solid ${config.relatorio.cor || '#0b2a3b'};padding-bottom:12px;margin-bottom:16px;">
                        <h1 style="font-size:1.6rem;color:#0b2a3b;margin:0;">${config.empresa.nome || 'Click Saúde Ambiental'}</h1>
                        <p style="color:#4d687a;font-size:0.9rem;">${config.empresa.endereco || ''} ${config.empresa.telefone ? ' - Tel: ' + config.empresa.telefone : ''}</p>
                        <p style="color:#4d687a;font-size:0.8rem;">${config.empresa.cnpj ? 'CNPJ: ' + config.empresa.cnpj : ''} ${config.empresa.email ? ' - ' + config.empresa.email : ''}</p>
                    </div>
                    
                    <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
                        <div>
                            <h2 style="font-size:1.3rem;color:#0b2a3b;margin:0;">${o.titulo || 'Proposta'}</h2>
                            <p style="color:#4d687a;font-size:0.9rem;">${o.numero}</p>
                        </div>
                        <div style="text-align:right;">
                            <p><strong>Data:</strong> ${o.data}</p>
                            <p><strong>Validade:</strong> ${o.validade || 15} dias</p>
                            <p><strong>Status:</strong> ${getStatusBadge(o.status)}</p>
                        </div>
                    </div>
                    
                    <div style="background:#f8fbfd;padding:12px 16px;border-radius:8px;margin-bottom:16px;">
                        <p><strong>Cliente:</strong> ${cliente ? cliente.nome : 'N/A'}</p>
                        <p><strong>Documento:</strong> ${cliente ? cliente.documento || 'N/A' : 'N/A'}</p>
                        <p><strong>Contato:</strong> ${cliente ? cliente.telefone || 'N/A' : 'N/A'}</p>
                        <p><strong>Endereço:</strong> ${cliente ? cliente.endereco || 'N/A' : 'N/A'}</p>
                    </div>
                    
                    ${o.mensagem ? '<div style="margin-bottom:12px;padding:8px 14px;background:#f0f7fc;border-radius:6px;border-left:3px solid #1d7a6b;"><p style="margin:0;font-style:italic;">' + o.mensagem + '</p></div>' : ''}
                    
                    <table style="width:100%;border-collapse:collapse;margin:12px 0;">
                        <thead>
                            <tr style="background:${config.relatorio.cor || '#0b2a3b'};color:white;">
                                <th style="padding:8px 12px;text-align:left;">Descrição do Serviço</th>
                                <th style="padding:8px 12px;text-align:center;">Qtd</th>
                                <th style="padding:8px 12px;text-align:right;">Valor Unit.</th>
                                <th style="padding:8px 12px;text-align:right;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itensHtml}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="3" style="padding:6px 10px;text-align:right;font-weight:600;">Total</td>
                                <td style="padding:6px 10px;text-align:right;font-weight:600;">${formatCurrency(total)}</td>
                            </tr>
                            ${o.desconto > 0 ? `
                            <tr>
                                <td colspan="3" style="padding:6px 10px;text-align:right;color:#b13e3a;">Desconto</td>
                                <td style="padding:6px 10px;text-align:right;color:#b13e3a;">- ${formatCurrency(o.desconto)}</td>
                            </tr>` : ''}
                            ${o.taxa > 0 ? `
                            <tr>
                                <td colspan="3" style="padding:6px 10px;text-align:right;color:#1d7a6b;">Taxa Adicional</td>
                                <td style="padding:6px 10px;text-align:right;color:#1d7a6b;">+ ${formatCurrency(o.taxa)}</td>
                            </tr>` : ''}
                            <tr style="border-top:2px solid #0b2a3b;">
                                <td colspan="3" style="padding:8px 10px;text-align:right;font-weight:700;font-size:1.1rem;">TOTAL FINAL</td>
                                <td style="padding:8px 10px;text-align:right;font-weight:700;font-size:1.1rem;color:${config.relatorio.cor || '#0b2a3b'};">${formatCurrency(totalFinal)}</td>
                            </tr>
                        </tfoot>
                    </table>
                    
                    ${o.observacoes ? `
                    <div style="margin-top:12px;padding:10px 14px;background:#f8fbfd;border-radius:6px;border-left:3px solid #0b2a3b;">
                        <p style="margin:0;font-size:0.9rem;"><strong>Condições:</strong> ${o.observacoes}</p>
                    </div>` : ''}
                    
                    <div style="margin-top:20px;text-align:center;font-size:0.8rem;color:#6a7f8d;border-top:1px solid #e8eff5;padding-top:16px;">
                        <p>${config.relatorio.rodape || 'Esta Proposta é de propriedade da empresa e tem validade de ' + (o.validade || 15) + ' dias.'}</p>
                    </div>
                    
                    <div class="modal-footer" style="margin-top:16px;">
                        <button class="btn-secondary" onclick="fecharModalOrcamento()">Fechar</button>
                        <button class="btn-primary" onclick="fecharModalOrcamento();editarOrcamento(${o.id})"><i class="fas fa-edit"></i> Editar</button>
                        <button class="btn-danger" onclick="enviarOrcamentoPDF(${o.id})"><i class="fas fa-file-pdf"></i> Enviar PDF</button>
                    </div>
                </div>
            `;
        }
    };

    window.fecharModalOrcamento = function () {
        var overlay = document.getElementById('modalOrcamentoOverlay');
        if (overlay) overlay.classList.remove('active');
    };

    var modalOrcamentoClose = document.getElementById('modalOrcamentoClose');
    if (modalOrcamentoClose) modalOrcamentoClose.addEventListener('click', fecharModalOrcamento);
    var modalOrcamentoOverlay = document.getElementById('modalOrcamentoOverlay');
    if (modalOrcamentoOverlay) {
        modalOrcamentoOverlay.addEventListener('click', function (e) {
            if (e.target === this) fecharModalOrcamento();
        });
    }

    window.enviarOrcamentoPDF = function (id) {
        var o = DB.getById('orcamentos', id);
        if (!o) {
            alert('Proposta não encontrado!');
            return;
        }

        var cliente = getCliente(o.clienteId);
        var config = DB.getConfig();
        var cor = config.relatorio.cor || '#0b2a3b';

        var itensHtml = o.itens.map(function (item) {
            var subtotal = item.quantidade * (item.valorUnitario || 0);
            return '<tr>' +
                '<td style="padding:8px 12px;border-bottom:1px solid #e8eff5;font-size:12px;">' + item.descricao + '</td>' +
                '<td style="padding:8px 12px;border-bottom:1px solid #e8eff5;text-align:center;font-size:12px;">' + item.quantidade + '</td>' +
                '<td style="padding:8px 12px;border-bottom:1px solid #e8eff5;text-align:right;font-size:12px;">' + formatCurrency(item.valorUnitario || 0) + '</td>' +
                '<td style="padding:8px 12px;border-bottom:1px solid #e8eff5;text-align:right;font-size:12px;font-weight:600;">' + formatCurrency(subtotal) + '</td>' +
                '</tr>';
        }).join('');

        var total = o.total || 0;
        var totalFinal = o.totalFinal || total;

        var logoHtml = config.empresa.logo ?
            '<img src="' + config.empresa.logo + '" style="max-height:60px;max-width:180px;object-fit:contain;" />' : '';

        var conteudo = `
            <html>
            <head>
                <title>Proposta ${o.numero}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: auto; font-size: 13px; line-height: 1.6; color: #1f3542; }
                    .header { text-align: center; border-bottom: 4px solid ${cor}; padding-bottom: 16px; margin-bottom: 20px; }
                    .header .logo-container { display: flex; align-items: center; justify-content: center; gap: 20px; flex-wrap: wrap; }
                    .header .logo-container img { max-height: 60px; max-width: 180px; }
                    .header h1 { color: #0b2a3b; font-size: 24px; margin: 0; }
                    .header .sub { color: #4d687a; font-size: 12px; }
                    .info { display: flex; justify-content: space-between; margin-bottom: 16px; }
                    .info .cliente { background: #f5f9fc; padding: 14px 18px; border-radius: 6px; flex: 1; }
                    .info .cliente p { margin: 3px 0; font-size: 12px; }
                    .info .dados { text-align: right; font-size: 12px; }
                    .info .dados p { margin: 3px 0; }
                    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
                    th { background: ${cor}; color: white; padding: 10px 12px; text-align: left; font-size: 11px; }
                    td { padding: 8px 12px; border-bottom: 1px solid #e8eff5; font-size: 12px; }
                    .total-row { font-weight: bold; }
                    .total-final { font-size: 18px; color: ${cor}; }
                    .footer { margin-top: 24px; text-align: center; color: #6a7f8d; font-size: 11px; border-top: 2px solid #e8eff5; padding-top: 20px; }
                    .mensagem { background: #f0f7fc; padding: 10px 16px; border-radius: 6px; border-left: 4px solid #1d7a6b; margin: 10px 0; font-style: italic; font-size: 12px; }
                    .obs { background: #f8fbfd; padding: 10px 16px; border-radius: 6px; border-left: 4px solid ${cor}; margin: 10px 0; font-size: 12px; }
                    .badge { padding: 3px 14px; border-radius: 20px; font-size: 11px; display: inline-block; font-weight: 600; }
                    .badge.success { background: #d1f0e5; color: #006b4f; }
                    .badge.warning { background: #fff2d0; color: #8e6100; }
                    .badge.danger { background: #fde2e0; color: #b13e3a; }
                    .badge.info { background: #d6eaf8; color: #1a5276; }
                    @media print {
                        body { padding: 20px; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo-container">
                        ${logoHtml}
                        <div>
                            <h1>${config.empresa.nome || 'Click Saúde Ambiental'}</h1>
                            <div class="sub">${config.empresa.endereco || ''} ${config.empresa.telefone ? ' - Tel: ' + config.empresa.telefone : ''}</div>
                            <div class="sub">${config.empresa.cnpj ? 'CNPJ: ' + config.empresa.cnpj : ''} ${config.empresa.email ? ' - ' + config.empresa.email : ''}</div>
                        </div>
                    </div>
                    <h2 style="margin:12px 0 0;color:#0b2a3b;font-size:20px;">${o.titulo || 'Proposta Comercial'}</h2>
                </div>

                <div class="info">
                    <div class="cliente">
                        <p><strong>Cliente:</strong> ${cliente ? cliente.nome : 'N/A'}</p>
                        <p><strong>Documento:</strong> ${cliente ? cliente.documento || 'N/A' : 'N/A'}</p>
                        <p><strong>Contato:</strong> ${cliente ? cliente.telefone || 'N/A' : 'N/A'}</p>
                        <p><strong>Endereço:</strong> ${cliente ? cliente.endereco || 'N/A' : 'N/A'}</p>
                    </div>
                    <div class="dados">
                        <p><strong>Proposta:</strong> ${o.numero}</p>
                        <p><strong>Data:</strong> ${o.data}</p>
                        <p><strong>Validade:</strong> ${o.validade || 15} dias</p>
                        <p><strong>Status:</strong> <span class="badge ${o.status === 'Aprovado' ? 'success' : o.status === 'Enviado' ? 'warning' : o.status === 'Rejeitado' ? 'danger' : 'info'}">${o.status}</span></p>
                    </div>
                </div>

                ${o.mensagem ? '<div class="mensagem">' + o.mensagem + '</div>' : ''}

                <table>
                    <thead>
                        <tr>
                            <th style="text-align:left;">Descrição</th>
                            <th style="text-align:center;">Qtd</th>
                            <th style="text-align:right;">Valor Unit.</th>
                            <th style="text-align:right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itensHtml}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="text-align:right;font-weight:600;padding:8px 12px;font-size:12px;">Total</td>
                            <td style="text-align:right;font-weight:600;padding:8px 12px;font-size:12px;">${formatCurrency(total)}</td>
                        </tr>
                        ${o.desconto > 0 ? `
                        <tr>
                            <td colspan="3" style="text-align:right;color:#b13e3a;padding:6px 12px;font-size:12px;">Desconto</td>
                            <td style="text-align:right;color:#b13e3a;padding:6px 12px;font-size:12px;">- ${formatCurrency(o.desconto)}</td>
                        </tr>` : ''}
                        ${o.taxa > 0 ? `
                        <tr>
                            <td colspan="3" style="text-align:right;color:#1d7a6b;padding:6px 12px;font-size:12px;">Taxa Adicional</td>
                            <td style="text-align:right;color:#1d7a6b;padding:6px 12px;font-size:12px;">+ ${formatCurrency(o.taxa)}</td>
                        </tr>` : ''}
                        <tr style="border-top:3px solid ${cor};">
                            <td colspan="3" style="text-align:right;font-weight:700;font-size:18px;padding:12px 12px;">TOTAL FINAL</td>
                            <td style="text-align:right;font-weight:700;font-size:18px;color:${cor};padding:12px 12px;">${formatCurrency(totalFinal)}</td>
                        </tr>
                    </tfoot>
                </table>

                ${o.observacoes ? '<div class="obs"><strong>Condições:</strong> ' + o.observacoes + '</div>' : ''}

                <div class="footer">
                    <p>${config.relatorio.rodape || 'Esta Proposta é de propriedade da empresa e tem validade de ' + (o.validade || 15) + ' dias.'}</p>
                </div>

                <script>
                    window.onload = function() { window.print(); }
                <\/script>
            </body>
            </html>
        `;

        var win = window.open('', '_blank', 'width=900,height=700');
        if (win) {
            win.document.write(conteudo);
            win.document.close();
        }
    };

    window.exportarOrcamentosExcel = function () {
        var orcamentos = DB.getAll('orcamentos');

        var filtrados = orcamentos.filter(function (o) {
            if (filtrosOrcamentos.clienteId) {
                if (String(o.clienteId) !== String(filtrosOrcamentos.clienteId)) return false;
            }
            if (filtrosOrcamentos.status) {
                if (o.status !== filtrosOrcamentos.status) return false;
            }
            if (filtrosOrcamentos.dataInicio) {
                var dataOrc = new Date(o.data.split('/').reverse().join('-'));
                var dataInicio = new Date(filtrosOrcamentos.dataInicio);
                if (dataOrc < dataInicio) return false;
            }
            if (filtrosOrcamentos.dataFim) {
                var dataOrc = new Date(o.data.split('/').reverse().join('-'));
                var dataFim = new Date(filtrosOrcamentos.dataFim);
                dataFim.setHours(23, 59, 59);
                if (dataOrc > dataFim) return false;
            }
            return true;
        });

        var data = filtrados.map(function (o) {
            var total = o.totalFinal || o.total || 0;
            return {
                'Número': o.numero,
                'Cliente': getClienteNome(o.clienteId),
                'Data': o.data,
                'Validade': o.validade || 15,
                'Total': total,
                'Status': o.status,
                'Itens': o.itens ? o.itens.length : 0
            };
        });

        var wb = XLSX.utils.book_new();
        var ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Propostas');
        XLSX.writeFile(wb, 'orcamentos_' + new Date().toISOString().split('T')[0] + '.xlsx');
    };

    window.exportarOrcamentosPDF = function () {
        var doc = new window.jspdf.jsPDF('p', 'mm', 'a4');
        doc.setFontSize(14);
        doc.text('Relatório de Propostas', 105, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.text('Gerado em: ' + new Date().toLocaleString('pt-BR'), 105, 28, { align: 'center' });

        var orcamentos = DB.getAll('orcamentos');

        var filtrados = orcamentos.filter(function (o) {
            if (filtrosOrcamentos.clienteId) {
                if (String(o.clienteId) !== String(filtrosOrcamentos.clienteId)) return false;
            }
            if (filtrosOrcamentos.status) {
                if (o.status !== filtrosOrcamentos.status) return false;
            }
            if (filtrosOrcamentos.dataInicio) {
                var dataOrc = new Date(o.data.split('/').reverse().join('-'));
                var dataInicio = new Date(filtrosOrcamentos.dataInicio);
                if (dataOrc < dataInicio) return false;
            }
            if (filtrosOrcamentos.dataFim) {
                var dataOrc = new Date(o.data.split('/').reverse().join('-'));
                var dataFim = new Date(filtrosOrcamentos.dataFim);
                dataFim.setHours(23, 59, 59);
                if (dataOrc > dataFim) return false;
            }
            return true;
        });

        var data = filtrados.map(function (o) {
            var total = o.totalFinal || o.total || 0;
            return [
                o.numero,
                getClienteNome(o.clienteId),
                o.data,
                o.validade || 15,
                formatCurrency(total),
                o.status
            ];
        });

        if (data.length === 0) {
            doc.text('Nenhuma proposta encontrado com os filtros aplicados.', 20, 40);
        } else {
            doc.autoTable({
                startY: 35,
                head: [['Número', 'Cliente', 'Data', 'Validade', 'Total', 'Status']],
                body: data,
                theme: 'striped',
                headStyles: { fillColor: [11, 42, 59] },
                styles: { fontSize: 8 }
            });
        }

        doc.save('orcamentos_' + new Date().toISOString().split('T')[0] + '.pdf');
    };

    // =============================================
    // ===== FILTROS PARA ORDENS DE SERVIÇO =====
    // =============================================

    var filtrosOS = {
        dataInicio: '',
        dataFim: '',
        clienteId: '',
        status: ''
    };

    window.aplicarFiltrosOS = function () {
        var dataInicio = document.getElementById('filtroOSDataInicio')?.value || '';
        var dataFim = document.getElementById('filtroOSDataFim')?.value || '';
        var clienteId = document.getElementById('filtroOSCliente')?.value || '';
        var status = document.getElementById('filtroOSStatus')?.value || '';

        filtrosOS.dataInicio = dataInicio;
        filtrosOS.dataFim = dataFim;
        filtrosOS.clienteId = clienteId;
        filtrosOS.status = status;

        renderOrdensComFiltros();
    };

    window.limparFiltrosOS = function () {
        document.getElementById('filtroOSDataInicio').value = '';
        document.getElementById('filtroOSDataFim').value = '';
        document.getElementById('filtroOSCliente').value = '';
        document.getElementById('filtroOSStatus').value = '';

        filtrosOS.dataInicio = '';
        filtrosOS.dataFim = '';
        filtrosOS.clienteId = '';
        filtrosOS.status = '';

        renderOrdensComFiltros();
    };

    function renderOrdensComFiltros() {
        var ordens = DB.getAll('ordens');
        var tbody = document.getElementById('tabelaOrdens');
        if (!tbody) return;

        var filtradas = ordens.filter(function (o) {
            if (filtrosOS.dataInicio) {
                var partes = o.data.split('/');
                var dataOS = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataInicio = new Date(filtrosOS.dataInicio);
                if (dataOS < dataInicio) return false;
            }
            if (filtrosOS.dataFim) {
                var partes = o.data.split('/');
                var dataOS = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataFim = new Date(filtrosOS.dataFim);
                dataFim.setHours(23, 59, 59);
                if (dataOS > dataFim) return false;
            }
            if (filtrosOS.clienteId) {
                if (String(o.clienteId) !== String(filtrosOS.clienteId)) return false;
            }
            if (filtrosOS.status) {
                if (o.status !== filtrosOS.status) return false;
            }
            return true;
        });

        if (filtradas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;padding:30px;">Nenhuma OS encontrada com os filtros aplicados</td></tr>';
            return;
        }

        tbody.innerHTML = filtradas.map(function (o) {
            var valorTotal = o.valorTotal || (o.itens ? o.itens.reduce(function (sum, item) { return sum + (item.quantidade * (item.valorUnitario || 0)); }, 0) : 0);
            var clienteNome = getClienteNome(o.clienteId);
            return '<tr>' +
                '<td><strong>' + o.numero + '</strong></td>' +
                '<td>' + clienteNome + '</td>' +
                '<td>' + o.data + '</td>' +
                '<td>' + formatCurrency(valorTotal) + '</td>' +
                '<td>' + getStatusBadge(o.status) + '</td>' +
                '<td>' +
                '<i class="fas fa-eye" onclick="visualizarOS(' + o.id + ')" title="Visualizar" style="color:#1d7a6b;"></i>' +
                '<i class="fas fa-edit" onclick="editarOS(' + o.id + ')" title="Editar"></i>' +
                '<i class="fas fa-print" onclick="imprimirOS(' + o.id + ')" title="Imprimir" style="color:#2c5c6b;"></i>' +
                '<i class="fas fa-trash" onclick="excluirOS(' + o.id + ')" title="Excluir" style="color:#b13e3a;"></i>' +
                '<i class="fas fa-pen" onclick="abrirAssinaturaOS(' + o.id + ')" title="Assinatura Digital" style="color:#8e44ad;"></i>' +
                '</td>' +
                '</tr>';
        }).join('');
    }

    // =============================================
    // ===== FILTROS PARA AGENDA =====
    // =============================================

    var filtrosAgenda = {
        dataInicio: '',
        dataFim: '',
        clienteId: '',
        status: ''
    };

    window.aplicarFiltrosAgenda = function () {
        var dataInicio = document.getElementById('filtroAgendaDataInicio')?.value || '';
        var dataFim = document.getElementById('filtroAgendaDataFim')?.value || '';
        var clienteId = document.getElementById('filtroAgendaCliente')?.value || '';
        var status = document.getElementById('filtroAgendaStatus')?.value || '';

        filtrosAgenda.dataInicio = dataInicio;
        filtrosAgenda.dataFim = dataFim;
        filtrosAgenda.clienteId = clienteId;
        filtrosAgenda.status = status;

        renderAgendaComFiltros();
    };

    window.limparFiltrosAgenda = function () {
        document.getElementById('filtroAgendaDataInicio').value = '';
        document.getElementById('filtroAgendaDataFim').value = '';
        document.getElementById('filtroAgendaCliente').value = '';
        document.getElementById('filtroAgendaStatus').value = '';

        filtrosAgenda.dataInicio = '';
        filtrosAgenda.dataFim = '';
        filtrosAgenda.clienteId = '';
        filtrosAgenda.status = '';

        renderAgendaComFiltros();
    };

    function renderAgendaComFiltros() {
        DB.forceClearCache('agenda');
        var agendaKey = DB.getFullKey('agenda');
        var agenda = JSON.parse(localStorage.getItem(agendaKey) || '[]');
        var container = document.getElementById('agendaList');
        if (!container) return;

        var temFiltroAtivo = filtrosAgenda.dataInicio || filtrosAgenda.dataFim ||
            filtrosAgenda.clienteId || filtrosAgenda.status;

        if (!temFiltroAtivo) {
            var hoje = new Date().toLocaleDateString('pt-BR');
            agenda = agenda.filter(function (a) {
                return a.data === hoje;
            });
        }

        var servicos = DB.getAll('servicos');
        var agendaAtualizada = false;

        agenda = agenda.map(function (a) {
            if (a.servicoId) {
                var servico = servicos.find(function (s) { return s.id === a.servicoId; });
                if (servico) {
                    if (a.statusServico !== servico.status) {
                        a.statusServico = servico.status;
                        a.descricao = atualizarDescricaoAgendamento(a, servico);
                        a.atualizadoEm = new Date().toISOString();
                        agendaAtualizada = true;
                    }
                    var cliente = getCliente(servico.clienteId);
                    a.clienteNome = cliente ? cliente.nome : 'Cliente #' + servico.clienteId;
                    a.clienteId = servico.clienteId;
                    a.data = servico.data;
                    a.tipoServico = servico.tipo;
                    a.tiposServico = servico.tipos || [servico.tipo];
                    a.horario = servico.horario || a.horario || '09:00';
                }
            } else if (a.clienteId) {
                var cliente = getCliente(a.clienteId);
                a.clienteNome = cliente ? cliente.nome : 'Cliente #' + a.clienteId;
            } else {
                a.clienteNome = 'Cliente não definido';
            }
            return a;
        });

        if (agendaAtualizada) {
            localStorage.setItem(agendaKey, JSON.stringify(agenda));
            DB.forceClearCache('agenda');
        }

        var filtrados = agenda.filter(function (a) {
            if (filtrosAgenda.dataInicio) {
                var partes = a.data.split('/');
                var dataAgenda = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataInicio = new Date(filtrosAgenda.dataInicio);
                if (dataAgenda < dataInicio) return false;
            }
            if (filtrosAgenda.dataFim) {
                var partes = a.data.split('/');
                var dataAgenda = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataFim = new Date(filtrosAgenda.dataFim);
                dataFim.setHours(23, 59, 59);
                if (dataAgenda > dataFim) return false;
            }
            if (filtrosAgenda.clienteId) {
                if (String(a.clienteId) !== String(filtrosAgenda.clienteId)) return false;
            }
            if (filtrosAgenda.status) {
                if (a.statusServico !== filtrosAgenda.status) return false;
            }
            return true;
        });

        var resultados = temFiltroAtivo ? filtrados : agenda;

        resultados.sort(function (a, b) {
            var dataA = a.data.split('/').reverse().join('');
            var dataB = b.data.split('/').reverse().join('');
            if (dataA !== dataB) return dataA.localeCompare(dataB);
            return (a.horario || '00:00').localeCompare(b.horario || '00:00');
        });

        if (resultados.length === 0) {
            container.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#999;padding:30px;">' +
                (temFiltroAtivo ? 'Nenhum agendamento encontrado com os filtros aplicados' : 'Nenhum agendamento para hoje') +
                '</div>';
            return;
        }

        container.innerHTML = resultados.map(function (a) {
            var clienteNome = a.clienteNome || 'Cliente não definido';
            var isServico = a.servicoId ? true : false;
            var icone = isServico ? '🔧' : '📌';
            var classeExtra = isServico ? ' agenda-servico' : '';

            var statusBadge = '';
            if (a.statusServico) {
                var statusMap = {
                    'Concluído': 'success',
                    'Concluida': 'success',
                    'Concluída': 'success',
                    'Em andamento': 'warning',
                    'Pendente': 'danger',
                    'Agendado': 'info',
                    'Agendada': 'info',
                    'Cancelado': 'danger',
                    'Cancelada': 'danger'
                };
                var classe = statusMap[a.statusServico] || 'info';
                statusBadge = '<span class="badge ' + classe + '" style="font-size:0.65rem;margin-left:6px;">' + a.statusServico + '</span>';
            }

            var tipoBadge = '';
            if (a.tiposServico && a.tiposServico.length > 0) {
                var tiposCores = {
                    'Desratização': '#e67e22',
                    'Desinsetização': '#1d7a6b',
                    'Descupinização': '#8e44ad'
                };
                var shortName = a.tiposServico.length > 1 ? 
                    a.tiposServico.map(function(t) { return t.substring(0, 3); }).join('+') : 
                    a.tiposServico[0].substring(0, 3);
                var cor = a.tiposServico.length > 1 ? '#2c5c6b' : (tiposCores[a.tiposServico[0]] || '#2c5c6b');
                tipoBadge = '<span style="display:inline-block;padding:0 8px;border-radius:10px;font-size:0.6rem;font-weight:600;background:' + cor + ';color:white;margin-left:4px;">' + shortName + '</span>';
            }

            var atualizadoInfo = '';
            if (a.atualizadoEm) {
                try {
                    var dataAtualizacao = new Date(a.atualizadoEm);
                    var diffMs = Date.now() - dataAtualizacao.getTime();
                    var diffMin = Math.floor(diffMs / 60000);
                    var diffStr = diffMin < 1 ? 'agora' : diffMin + 'min';
                    atualizadoInfo = ' <span style="font-size:0.5rem;color:#999;font-weight:300;">(atualizado ' + diffStr + ')</span>';
                } catch (e) { }
            }

            return '<div class="agenda-item' + classeExtra + '" style="' + (isServico ? 'border-left-color: #0b2a3b;' : '') + '">' +
                '<div style="flex:1;min-width:0;">' +
                '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;">' +
                '<i class="fas fa-clock" style="color:#1d7a6b;font-size:1rem;"></i>' +
                '<strong style="font-size:0.95rem;">' + (a.horario || '09:00') + '</strong>' +
                '<span style="color:#4d687a;font-size:0.85rem;">- ' + a.data + '</span>' +
                tipoBadge +
                statusBadge +
                atualizadoInfo +
                '</div>' +
                '<div style="font-weight:400;font-size:0.9rem;margin-top:2px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
                '<span>' + icone + '</span>' +
                '<span>' + a.descricao + '</span>' +
                (isServico ? '<span style="font-size:0.6rem;color:#1d7a6b;background:#d1f0e5;padding:0 8px;border-radius:10px;">Auto</span>' : '') +
                '</div>' +
                '<div style="font-size:0.8rem;color:#4d687a;margin-top:2px;">' +
                '<i class="fas fa-user" style="font-size:0.7rem;"></i> ' + clienteNome +
                '</div>' +
                '</div>' +
                '</div>';
        }).join('');

    }

    // =============================================
    // ===== FUNÇÕES DE CLIENTES =====
    // =============================================

    function aplicarMascaraDocumento(input) {
        var tipo = document.getElementById('modalTipoCliente')?.value || 'cpf';
        var value = input.value.replace(/\D/g, '');

        if (tipo === 'cpf') {
            if (value.length > 11) value = value.slice(0, 11);
            if (value.length <= 3) {
                input.value = value;
            } else if (value.length <= 6) {
                input.value = value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
            } else if (value.length <= 9) {
                input.value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
            } else {
                input.value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
            }
        } else {
            if (value.length > 14) value = value.slice(0, 14);
            if (value.length <= 2) {
                input.value = value;
            } else if (value.length <= 5) {
                input.value = value.replace(/(\d{2})(\d{1,3})/, '$1.$2');
            } else if (value.length <= 8) {
                input.value = value.replace(/(\d{2})(\d{3})(\d{1,3})/, '$1.$2.$3');
            } else if (value.length <= 12) {
                input.value = value.replace(/(\d{2})(\d{3})(\d{3})(\d{1,4})/, '$1.$2.$3/$4');
            } else {
                input.value = value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5');
            }
        }
    }

    window.criarNovoCliente = function () {
        var tipoCliente = document.getElementById('modalTipoCliente')?.value || 'cpf';
        var nome = document.getElementById('modalNome')?.value || '';
        var documento = document.getElementById('modalDocumento')?.value || '';
        var telefone = document.getElementById('modalTelefone')?.value || '';
        var endereco = document.getElementById('modalEndereco')?.value || '';

        var razaoSocial = '';
        var nomeFantasia = '';

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

        var clienteData = {
            nome: nome,
            tipoCliente: tipoCliente,
            documento: documento,
            telefone: telefone,
            endereco: endereco,
            ultimoServico: 'N/A'
        };

        if (tipoCliente === 'cnpj') {
            clienteData.razaoSocial = razaoSocial;
            clienteData.nomeFantasia = nomeFantasia;
        }

        DB.add('clientes', clienteData);

        DB.forceClearCache('clientes');

        fecharModal();

        renderAll();

        setTimeout(function () {
            renderAll();
        }, 100);

        alert('Cliente adicionado com sucesso!');
    };

    window.editarCliente = function (id) {
        var c = DB.getById('clientes', id);
        if (!c) return;

        var isCnpj = c.tipoCliente === 'cnpj';
        var razaoSocial = c.razaoSocial || '';
        var nomeFantasia = c.nomeFantasia || '';

        abrirModal('Editar Cliente', `
            <div class="form-group">
                <label id="labelNome">${isCnpj ? 'Nome Fantasia *' : 'Nome *'}</label>
                <input type="text" id="modalNome" value="${c.nome}" placeholder="${isCnpj ? 'Nome Fantasia da empresa' : 'Nome completo'}" />
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Tipo de Cliente *</label>
                    <select id="modalTipoCliente" onchange="toggleDocumentoCliente(); toggleCamposCnpj();">
                        <option value="cpf" ${!isCnpj ? 'selected' : ''}>Pessoa Física (CPF)</option>
                        <option value="cnpj" ${isCnpj ? 'selected' : ''}>Pessoa Jurídica (CNPJ)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label id="labelDocumento">${isCnpj ? 'CNPJ *' : 'CPF *'}</label>
                    <input type="text" id="modalDocumento" value="${c.documento || ''}" placeholder="${isCnpj ? '00.000.000/0001-00' : '000.000.000-00'}" maxlength="${isCnpj ? 18 : 14}" />
                </div>
            </div>
            <div id="camposCnpj" style="${isCnpj ? 'display:block;' : 'display:none;'}">
                <div class="form-group">
                    <label>Razão Social *</label>
                    <input type="text" id="modalRazaoSocial" value="${razaoSocial}" placeholder="Razão Social da empresa" />
                </div>
                <div class="form-group">
                    <label>Nome Fantasia</label>
                    <input type="text" id="modalNomeFantasia" value="${nomeFantasia}" placeholder="Nome Fantasia da empresa" />
                </div>
            </div>
            <div class="form-group">
                <label>Telefone</label>
                <input type="text" id="modalTelefone" value="${c.telefone}" placeholder="(11) 99999-9999" />
            </div>
            <div class="form-group">
                <label>Endereço</label>
                <input type="text" id="modalEndereco" value="${c.endereco}" placeholder="Rua, número, bairro, cidade - UF" />
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="fecharModal()">Cancelar</button>
                <button class="btn-primary" onclick="salvarEdicaoCliente(${id})">Salvar</button>
            </div>
        `);

        setTimeout(function () {
            var input = document.getElementById('modalDocumento');
            if (input) {
                input.addEventListener('input', function (e) {
                    aplicarMascaraDocumento(e.target);
                });
            }
        }, 100);
    };

    window.salvarEdicaoCliente = function (id) {
        var tipoCliente = document.getElementById('modalTipoCliente')?.value || 'cpf';
        var nome = document.getElementById('modalNome')?.value || '';
        var documento = document.getElementById('modalDocumento')?.value || '';
        var telefone = document.getElementById('modalTelefone')?.value || '';
        var endereco = document.getElementById('modalEndereco')?.value || '';

        var razaoSocial = '';
        var nomeFantasia = '';

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

        var updateData = {
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

        DB.update('clientes', id, updateData);

        DB.forceClearCache('clientes');

        fecharModal();
        renderAll();
        alert('Cliente atualizado com sucesso!');
    };

    window.excluirCliente = function (id) {
        if (confirm('Tem certeza que deseja excluir este cliente?')) {
            DB.remove('clientes', id);
            DB.forceClearCache('clientes');
            renderAll();
        }
    };

    // =============================================
    // ===== EXPORTAÇÕES COM FILTROS =====
    // =============================================

    window.exportarMapaExcel = function () {
        var pontos = DB.getAll('pontosIscas');

        var filtrados = pontos.filter(function (p) {
            if (filtrosMapa.clienteId) {
                if (String(p.clienteId) !== String(filtrosMapa.clienteId)) return false;
            }
            if (filtrosMapa.tipo) {
                if (p.tipo !== filtrosMapa.tipo) return false;
            }
            if (filtrosMapa.status) {
                if (p.status !== filtrosMapa.status) return false;
            }
            if (filtrosMapa.busca) {
                var cliente = getCliente(p.clienteId);
                var clienteNome = cliente ? cliente.nome.toLowerCase() : '';
                var searchFields = [
                    (p.numero || p.nome || '').toLowerCase(),
                    (p.localizacao || p.posicao || '').toLowerCase(),
                    clienteNome,
                    (p.observacoes || '').toLowerCase()
                ];
                var found = searchFields.some(function (field) {
                    return field.indexOf(filtrosMapa.busca) !== -1;
                });
                if (!found) return false;
            }
            return true;
        });

        var statusLabels = {
            'ok': 'Ok',
            'consumo': 'Consumo',
            'danificado': 'Danificado',
            'substituido': 'Substituído'
        };

        var data = filtrados.map(function (p) {
            var cliente = getCliente(p.clienteId);
            return {
                'Número': p.numero || p.nome || 'N/A',
                'Cliente': cliente ? cliente.nome : 'N/A',
                'Tipo': p.tipo === 'porta-isca' ? 'Porta Isca' : 'Túnel',
                'Localização': p.localizacao || p.posicao || 'N/A',
                'Status': statusLabels[p.status] || p.status || 'N/A',
                'Data Instalação': p.dataInstalacao || 'N/A',
                'Manutenção': p.manutencao ? 'Sim' : 'Não',
                'Instalação': p.instalacao ? 'Sim' : 'Não',
                'Observações': p.observacoes || ''
            };
        });

        var wb = XLSX.utils.book_new();
        var ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Pontos de Isca');
        XLSX.writeFile(wb, 'mapa_iscas_filtrado_' + new Date().toISOString().split('T')[0] + '.xlsx');
    };

    window.exportarMapaPDF = function () {
        var doc = new window.jspdf.jsPDF('p', 'mm', 'a4');
        doc.setFontSize(14);
        doc.text('Relatório - Pontos de Isca', 105, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.text('Gerado em: ' + new Date().toLocaleString('pt-BR'), 105, 28, { align: 'center' });

        var pontos = DB.getAll('pontosIscas');

        var filtrados = pontos.filter(function (p) {
            if (filtrosMapa.clienteId) {
                if (String(p.clienteId) !== String(filtrosMapa.clienteId)) return false;
            }
            if (filtrosMapa.tipo) {
                if (p.tipo !== filtrosMapa.tipo) return false;
            }
            if (filtrosMapa.status) {
                if (p.status !== filtrosMapa.status) return false;
            }
            if (filtrosMapa.busca) {
                var cliente = getCliente(p.clienteId);
                var clienteNome = cliente ? cliente.nome.toLowerCase() : '';
                var searchFields = [
                    (p.numero || p.nome || '').toLowerCase(),
                    (p.localizacao || p.posicao || '').toLowerCase(),
                    clienteNome,
                    (p.observacoes || '').toLowerCase()
                ];
                var found = searchFields.some(function (field) {
                    return field.indexOf(filtrosMapa.busca) !== -1;
                });
                if (!found) return false;
            }
            return true;
        });

        var statusLabels = {
            'ok': 'Ok',
            'consumo': 'Consumo',
            'danificado': 'Danificado',
            'substituido': 'Substituído'
        };

        var data = filtrados.map(function (p) {
            var cliente = getCliente(p.clienteId);
            var manutencaoStr = p.manutencao ? '🔧 Sim' : 'Não';
            var instalacaoStr = p.instalacao ? '📦 Sim' : 'Não';
            return [
                p.numero || p.nome || 'N/A',
                cliente ? cliente.nome : 'N/A',
                p.tipo === 'porta-isca' ? 'Porta Isca' : 'Túnel',
                statusLabels[p.status] || p.status || 'N/A',
                p.localizacao || p.posicao || 'N/A',
                manutencaoStr,
                instalacaoStr
            ];
        });

        if (data.length === 0) {
            doc.text('Nenhum ponto encontrado com os filtros aplicados.', 20, 40);
        } else {
            doc.autoTable({
                startY: 35,
                head: [['Número', 'Cliente', 'Tipo', 'Status', 'Localização', 'Manutenção', 'Instalação']],
                body: data,
                theme: 'striped',
                headStyles: { fillColor: [11, 42, 59] },
                styles: { fontSize: 7 },
                columnStyles: {
                    4: { cellWidth: 50 }
                }
            });
        }

        doc.save('mapa_iscas_filtrado_' + new Date().toISOString().split('T')[0] + '.pdf');
    };

    window.exportarServicosExcel = function () {
        var servicos = DB.getAll('servicos');

        var filtrados = servicos.filter(function (s) {
            if (filtrosServicos.dataInicio) {
                var partes = s.data.split('/');
                var dataServico = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataInicio = new Date(filtrosServicos.dataInicio);
                if (dataServico < dataInicio) return false;
            }
            if (filtrosServicos.dataFim) {
                var partes = s.data.split('/');
                var dataServico = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataFim = new Date(filtrosServicos.dataFim);
                dataFim.setHours(23, 59, 59);
                if (dataServico > dataFim) return false;
            }
            if (filtrosServicos.clienteId) {
                if (String(s.clienteId) !== String(filtrosServicos.clienteId)) return false;
            }
            if (filtrosServicos.tipo) {
                var tipos = s.tipos || [s.tipo];
                if (!tipos.includes(filtrosServicos.tipo)) return false;
            }
            if (filtrosServicos.status) {
                if (s.status !== filtrosServicos.status) return false;
            }
            return true;
        });

        var data = filtrados.map(function (s) {
            return {
                'ID': s.id,
                'Cliente': getClienteNome(s.clienteId),
                'Tipo': s.tipo,
                'Data': s.data,
                'Status': s.status,
                'Valor': s.valor || 0
            };
        });

        var wb = XLSX.utils.book_new();
        var ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Serviços');
        XLSX.writeFile(wb, 'servicos_filtrados_' + new Date().toISOString().split('T')[0] + '.xlsx');
    };

    window.exportarOSExcel = function () {
        var ordens = DB.getAll('ordens');

        var filtradas = ordens.filter(function (o) {
            if (filtrosOS.dataInicio) {
                var partes = o.data.split('/');
                var dataOS = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataInicio = new Date(filtrosOS.dataInicio);
                if (dataOS < dataInicio) return false;
            }
            if (filtrosOS.dataFim) {
                var partes = o.data.split('/');
                var dataOS = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataFim = new Date(filtrosOS.dataFim);
                dataFim.setHours(23, 59, 59);
                if (dataOS > dataFim) return false;
            }
            if (filtrosOS.clienteId) {
                if (String(o.clienteId) !== String(filtrosOS.clienteId)) return false;
            }
            if (filtrosOS.status) {
                if (o.status !== filtrosOS.status) return false;
            }
            return true;
        });

        var data = filtradas.map(function (o) {
            var valorTotal = o.valorTotal || (o.itens ? o.itens.reduce(function (sum, item) { return sum + (item.quantidade * (item.valorUnitario || 0)); }, 0) : 0);
            return {
                'OS': o.numero,
                'Cliente': getClienteNome(o.clienteId),
                'Data': o.data,
                'Status': o.status,
                'Valor Total': valorTotal
            };
        });

        var wb = XLSX.utils.book_new();
        var ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Ordens');
        XLSX.writeFile(wb, 'ordens_filtradas_' + new Date().toISOString().split('T')[0] + '.xlsx');
    };

    window.exportarAgendaExcel = function () {
        var agendaKey = DB.getFullKey('agenda');
        var agenda = JSON.parse(localStorage.getItem(agendaKey) || '[]');

        var filtrados = agenda.filter(function (a) {
            if (filtrosAgenda.dataInicio) {
                var partes = a.data.split('/');
                var dataAgenda = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataInicio = new Date(filtrosAgenda.dataInicio);
                if (dataAgenda < dataInicio) return false;
            }
            if (filtrosAgenda.dataFim) {
                var partes = a.data.split('/');
                var dataAgenda = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataFim = new Date(filtrosAgenda.dataFim);
                dataFim.setHours(23, 59, 59);
                if (dataAgenda > dataFim) return false;
            }
            if (filtrosAgenda.clienteId) {
                if (String(a.clienteId) !== String(filtrosAgenda.clienteId)) return false;
            }
            if (filtrosAgenda.status) {
                if (a.statusServico !== filtrosAgenda.status) return false;
            }
            return true;
        });

        var data = filtrados.map(function (a) {
            return {
                'Data': a.data,
                'Horário': a.horario || '09:00',
                'Cliente': a.clienteNome || getClienteNome(a.clienteId),
                'Descrição': a.descricao || '',
                'Status': a.statusServico || '',
                'Tipo': a.tipoServico || ''
            };
        });

        var wb = XLSX.utils.book_new();
        var ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Agenda');
        XLSX.writeFile(wb, 'agenda_filtrada_' + new Date().toISOString().split('T')[0] + '.xlsx');
    };

    // =============================================
    // ===== FUNÇÕES DE EXPORTAÇÃO PDF SIMPLES =====
    // =============================================

    window.exportarServicosPDF = function () {
        var doc = new window.jspdf.jsPDF('p', 'mm', 'a4');
        doc.setFontSize(14);
        doc.text('Relatório de Serviços', 105, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.text('Gerado em: ' + new Date().toLocaleString('pt-BR'), 105, 28, { align: 'center' });

        var servicos = DB.getAll('servicos');
        var filtrados = servicos.filter(function (s) {
            if (filtrosServicos.dataInicio) {
                var partes = s.data.split('/');
                var dataServico = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataInicio = new Date(filtrosServicos.dataInicio);
                if (dataServico < dataInicio) return false;
            }
            if (filtrosServicos.dataFim) {
                var partes = s.data.split('/');
                var dataServico = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataFim = new Date(filtrosServicos.dataFim);
                dataFim.setHours(23, 59, 59);
                if (dataServico > dataFim) return false;
            }
            if (filtrosServicos.clienteId) {
                if (String(s.clienteId) !== String(filtrosServicos.clienteId)) return false;
            }
            if (filtrosServicos.tipo) {
                var tipos = s.tipos || [s.tipo];
                if (!tipos.includes(filtrosServicos.tipo)) return false;
            }
            if (filtrosServicos.status) {
                if (s.status !== filtrosServicos.status) return false;
            }
            return true;
        });

        var data = filtrados.map(function (s) {
            return [s.id, getClienteNome(s.clienteId), s.tipo, s.data, s.status, s.valor || 0];
        });

        if (data.length === 0) {
            doc.text('Nenhum serviço encontrado com os filtros aplicados.', 20, 40);
        } else {
            doc.autoTable({
                startY: 35,
                head: [['ID', 'Cliente', 'Tipo', 'Data', 'Status', 'Valor']],
                body: data,
                theme: 'striped',
                headStyles: { fillColor: [11, 42, 59] },
                styles: { fontSize: 8 }
            });
        }

        doc.save('servicos_filtrados_' + new Date().toISOString().split('T')[0] + '.pdf');
    };

    window.exportarOSPDF = function () {
        var doc = new window.jspdf.jsPDF('p', 'mm', 'a4');
        doc.setFontSize(14);
        doc.text('Relatório de Ordens de Serviço', 105, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.text('Gerado em: ' + new Date().toLocaleString('pt-BR'), 105, 28, { align: 'center' });

        var ordens = DB.getAll('ordens');
        var filtradas = ordens.filter(function (o) {
            if (filtrosOS.dataInicio) {
                var partes = o.data.split('/');
                var dataOS = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataInicio = new Date(filtrosOS.dataInicio);
                if (dataOS < dataInicio) return false;
            }
            if (filtrosOS.dataFim) {
                var partes = o.data.split('/');
                var dataOS = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataFim = new Date(filtrosOS.dataFim);
                dataFim.setHours(23, 59, 59);
                if (dataOS > dataFim) return false;
            }
            if (filtrosOS.clienteId) {
                if (String(o.clienteId) !== String(filtrosOS.clienteId)) return false;
            }
            if (filtrosOS.status) {
                if (o.status !== filtrosOS.status) return false;
            }
            return true;
        });

        var data = filtradas.map(function (o) {
            var valorTotal = o.valorTotal || (o.itens ? o.itens.reduce(function (sum, item) { return sum + (item.quantidade * (item.valorUnitario || 0)); }, 0) : 0);
            return [o.numero, getClienteNome(o.clienteId), o.data, o.status, formatCurrency(valorTotal)];
        });

        if (data.length === 0) {
            doc.text('Nenhuma OS encontrada com os filtros aplicados.', 20, 40);
        } else {
            doc.autoTable({
                startY: 35,
                head: [['OS', 'Cliente', 'Data', 'Status', 'Valor Total']],
                body: data,
                theme: 'striped',
                headStyles: { fillColor: [11, 42, 59] },
                styles: { fontSize: 8 }
            });
        }

        doc.save('ordens_filtradas_' + new Date().toISOString().split('T')[0] + '.pdf');
    };

    window.exportarAgendaPDF = function () {
        var doc = new window.jspdf.jsPDF('p', 'mm', 'a4');
        doc.setFontSize(14);
        doc.text('Relatório de Agenda', 105, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.text('Gerado em: ' + new Date().toLocaleString('pt-BR'), 105, 28, { align: 'center' });

        var agendaKey = DB.getFullKey('agenda');
        var agenda = JSON.parse(localStorage.getItem(agendaKey) || '[]');
        var filtrados = agenda.filter(function (a) {
            if (filtrosAgenda.dataInicio) {
                var partes = a.data.split('/');
                var dataAgenda = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataInicio = new Date(filtrosAgenda.dataInicio);
                if (dataAgenda < dataInicio) return false;
            }
            if (filtrosAgenda.dataFim) {
                var partes = a.data.split('/');
                var dataAgenda = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataFim = new Date(filtrosAgenda.dataFim);
                dataFim.setHours(23, 59, 59);
                if (dataAgenda > dataFim) return false;
            }
            if (filtrosAgenda.clienteId) {
                if (String(a.clienteId) !== String(filtrosAgenda.clienteId)) return false;
            }
            if (filtrosAgenda.status) {
                if (a.statusServico !== filtrosAgenda.status) return false;
            }
            return true;
        });

        var data = filtrados.map(function (a) {
            return [a.data, a.horario || '09:00', a.clienteNome || getClienteNome(a.clienteId), a.descricao || '', a.statusServico || ''];
        });

        if (data.length === 0) {
            doc.text('Nenhum agendamento encontrado com os filtros aplicados.', 20, 40);
        } else {
            doc.autoTable({
                startY: 35,
                head: [['Data', 'Horário', 'Cliente', 'Descrição', 'Status']],
                body: data,
                theme: 'striped',
                headStyles: { fillColor: [11, 42, 59] },
                styles: { fontSize: 7 },
                columnStyles: {
                    3: { cellWidth: 60 }
                }
            });
        }

        doc.save('agenda_filtrada_' + new Date().toISOString().split('T')[0] + '.pdf');
    };

    // =============================================
    // ===== RELATÓRIO FINANCEIRO =====
    // =============================================

    var filtrosFinanceiro = {
        dataInicio: '',
        dataFim: '',
        clienteId: '',
        tipo: ''
    };

    window.aplicarFiltrosFinanceiro = function () {
        var dataInicio = document.getElementById('filtroFinanceiroDataInicio')?.value || '';
        var dataFim = document.getElementById('filtroFinanceiroDataFim')?.value || '';
        var clienteId = document.getElementById('filtroFinanceiroCliente')?.value || '';
        var tipo = document.getElementById('filtroFinanceiroTipo')?.value || '';

        filtrosFinanceiro.dataInicio = dataInicio;
        filtrosFinanceiro.dataFim = dataFim;
        filtrosFinanceiro.clienteId = clienteId;
        filtrosFinanceiro.tipo = tipo;

        renderFinanceiro();
    };

    window.limparFiltrosFinanceiro = function () {
        document.getElementById('filtroFinanceiroDataInicio').value = '';
        document.getElementById('filtroFinanceiroDataFim').value = '';
        document.getElementById('filtroFinanceiroCliente').value = '';
        document.getElementById('filtroFinanceiroTipo').value = '';

        filtrosFinanceiro.dataInicio = '';
        filtrosFinanceiro.dataFim = '';
        filtrosFinanceiro.clienteId = '';
        filtrosFinanceiro.tipo = '';

        renderFinanceiro();
    };

    function getDadosFinanceiros() {
        var servicos = DB.getAll('servicos');
        var ordens = DB.getAll('ordens');
        var items = [];

        servicos.forEach(function (s) {
            if (s.status === 'Concluído' || s.status === 'Concluida' || s.status === 'Concluída') {
                if (s.valor && s.valor > 0) {
                    items.push({
                        id: s.id,
                        data: s.data,
                        clienteId: s.clienteId,
                        tipo: s.tipo,
                        descricao: 'Serviço #' + String(s.id).padStart(3, '0'),
                        valor: s.valor,
                        status: s.status,
                        fonte: 'servico'
                    });
                }
            }
        });

        ordens.forEach(function (o) {
            if (o.status === 'Concluída' || o.status === 'Concluído') {
                var servicoExistente = items.some(function (i) {
                    return i.fonte === 'servico' && i.id === o.servicoId;
                });

                if (!servicoExistente) {
                    var valorOS = 0;
                    if (o.itens && o.itens.length > 0) {
                        valorOS = o.itens.reduce(function (sum, item) {
                            return sum + (item.quantidade * (item.valorUnitario || 0));
                        }, 0);
                    } else if (o.valorTotal) {
                        valorOS = o.valorTotal;
                    }

                    if (valorOS > 0) {
                        items.push({
                            id: o.id,
                            data: o.data,
                            clienteId: o.clienteId,
                            tipo: o.tipo || 'OS',
                            descricao: o.numero || 'OS #' + String(o.id).padStart(3, '0'),
                            valor: valorOS,
                            status: o.status,
                            fonte: 'os'
                        });
                    }
                }
            }
        });

        return items;
    }

    function renderFinanceiro() {
        var items = getDadosFinanceiros();
        var tbody = document.getElementById('tabelaFinanceiro');
        if (!tbody) return;

        var filtrados = items.filter(function (item) {
            if (filtrosFinanceiro.dataInicio) {
                var partes = item.data.split('/');
                var dataItem = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataInicio = new Date(filtrosFinanceiro.dataInicio);
                if (dataItem < dataInicio) return false;
            }
            if (filtrosFinanceiro.dataFim) {
                var partes = item.data.split('/');
                var dataItem = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataFim = new Date(filtrosFinanceiro.dataFim);
                dataFim.setHours(23, 59, 59);
                if (dataItem > dataFim) return false;
            }
            if (filtrosFinanceiro.clienteId) {
                if (String(item.clienteId) !== String(filtrosFinanceiro.clienteId)) return false;
            }
            if (filtrosFinanceiro.tipo) {
                if (item.tipo !== filtrosFinanceiro.tipo) return false;
            }
            return true;
        });

        filtrados.sort(function (a, b) {
            var dataA = a.data.split('/').reverse().join('');
            var dataB = b.data.split('/').reverse().join('');
            return dataB.localeCompare(dataA);
        });

        var totalFaturado = filtrados.reduce(function (sum, item) { return sum + item.valor; }, 0);
        var totalServicos = filtrados.filter(function (item) { return item.fonte === 'servico'; }).length;
        var totalOS = filtrados.filter(function (item) { return item.fonte === 'os'; }).length;
        var clientesAtendidos = new Set(filtrados.map(function (item) { return item.clienteId; })).size;
        var ticketMedio = filtrados.length > 0 ? totalFaturado / filtrados.length : 0;

        document.getElementById('financeiroTotalFaturado').textContent = formatCurrency(totalFaturado);
        document.getElementById('financeiroTotalServicos').textContent = totalServicos;
        document.getElementById('financeiroTotalOS').textContent = totalOS;
        document.getElementById('financeiroTotalClientes').textContent = clientesAtendidos;
        document.getElementById('financeiroTicketMedio').textContent = formatCurrency(ticketMedio);

        if (filtrados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;padding:30px;">Nenhum faturamento encontrado com os filtros aplicados</td></tr>';
        } else {
            tbody.innerHTML = filtrados.map(function (item) {
                var clienteNome = getClienteNome(item.clienteId);
                var statusBadge = getStatusBadge(item.status);
                var fonteIcon = item.fonte === 'servico' ? '🔧' : '📄';
                return '<tr>' +
                    '<td>' + item.data + '</td>' +
                    '<td>' + clienteNome + '</td>' +
                    '<td>' + item.tipo + '</td>' +
                    '<td>' + fonteIcon + ' ' + item.descricao + '</td>' +
                    '<td><strong>' + formatCurrency(item.valor) + '</strong></td>' +
                    '<td>' + statusBadge + '</td>' +
                    '</tr>';
            }).join('');
        }

        renderFinanceiroGraficos(filtrados);
    }

    function renderFinanceiroGraficos(items) {
        var periodoData = {};
        items.forEach(function (item) {
            var partes = item.data.split('/');
            var mesAno = partes[1] + '/' + partes[2];
            if (!periodoData[mesAno]) {
                periodoData[mesAno] = 0;
            }
            periodoData[mesAno] += item.valor;
        });

        var periodoEntries = Object.entries(periodoData);
        periodoEntries.sort(function (a, b) {
            var dataA = a[0].split('/').reverse().join('');
            var dataB = b[0].split('/').reverse().join('');
            return dataA.localeCompare(dataB);
        });

        var maxValor = periodoEntries.length > 0 ? Math.max.apply(null, periodoEntries.map(function (e) { return e[1]; })) : 1;

        var periodoHtml = periodoEntries.length > 0 ? periodoEntries.map(function (entry) {
            var mes = entry[0];
            var valor = entry[1];
            var percentual = (valor / maxValor) * 100;
            return '<div class="financeiro-periodo-item">' +
                '<span class="periodo">' + mes + '</span>' +
                '<div class="barra-container">' +
                '<div class="barra" style="width:' + percentual + '%;"></div>' +
                '</div>' +
                '<span class="valor">' + formatCurrency(valor) + '</span>' +
                '</div>';
        }).join('') : '<p style="color:#999;text-align:center;padding:20px;">Nenhum dado para exibir</p>';

        var elPeriodo = document.getElementById('financeiroGraficoPeriodo');
        if (elPeriodo) elPeriodo.innerHTML = periodoHtml;

        var tipoData = {};
        items.forEach(function (item) {
            if (!tipoData[item.tipo]) {
                tipoData[item.tipo] = 0;
            }
            tipoData[item.tipo] += item.valor;
        });

        var tipoEntries = Object.entries(tipoData);
        tipoEntries.sort(function (a, b) { return b[1] - a[1]; });

        var totalGeral = tipoEntries.reduce(function (sum, e) { return sum + e[1]; }, 0);

        var tipoHtml = tipoEntries.length > 0 ? tipoEntries.map(function (entry) {
            var tipo = entry[0];
            var valor = entry[1];
            var percentual = totalGeral > 0 ? (valor / totalGeral * 100).toFixed(1) : 0;
            var cores = {
                'Desratização': '#e67e22',
                'Desinsetização': '#1d7a6b',
                'Descupinização': '#8e44ad'
            };
            var cor = cores[tipo] || '#2c5c6b';
            return '<div class="financeiro-tipo-item">' +
                '<span class="tipo"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:' + cor + ';margin-right:8px;"></span>' + tipo + '</span>' +
                '<span class="valor">' + formatCurrency(valor) + ' (' + percentual + '%)</span>' +
                '</div>';
        }).join('') : '<p style="color:#999;text-align:center;padding:20px;">Nenhum dado para exibir</p>';

        var elTipo = document.getElementById('financeiroGraficoTipo');
        if (elTipo) elTipo.innerHTML = tipoHtml;
    }

    window.exportarFinanceiroExcel = function () {
        var items = getDadosFinanceiros();

        var filtrados = items.filter(function (item) {
            if (filtrosFinanceiro.dataInicio) {
                var partes = item.data.split('/');
                var dataItem = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataInicio = new Date(filtrosFinanceiro.dataInicio);
                if (dataItem < dataInicio) return false;
            }
            if (filtrosFinanceiro.dataFim) {
                var partes = item.data.split('/');
                var dataItem = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataFim = new Date(filtrosFinanceiro.dataFim);
                dataFim.setHours(23, 59, 59);
                if (dataItem > dataFim) return false;
            }
            if (filtrosFinanceiro.clienteId) {
                if (String(item.clienteId) !== String(filtrosFinanceiro.clienteId)) return false;
            }
            if (filtrosFinanceiro.tipo) {
                if (item.tipo !== filtrosFinanceiro.tipo) return false;
            }
            return true;
        });

        var data = filtrados.map(function (item) {
            return {
                'Data': item.data,
                'Cliente': getClienteNome(item.clienteId),
                'Tipo': item.tipo,
                'Descrição': item.descricao,
                'Valor (R$)': item.valor,
                'Status': item.status
            };
        });

        var wb = XLSX.utils.book_new();
        var ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Faturamento');

        var totalFaturado = filtrados.reduce(function (sum, item) { return sum + item.valor; }, 0);
        var resumo = [
            { 'Métrica': 'Total Faturado', 'Valor': formatCurrency(totalFaturado) },
            { 'Métrica': 'Total de Itens', 'Valor': filtrados.length },
            { 'Métrica': 'Clientes Atendidos', 'Valor': new Set(filtrados.map(function (item) { return item.clienteId; })).size }
        ];
        var wsResumo = XLSX.utils.json_to_sheet(resumo);
        XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

        XLSX.writeFile(wb, 'relatorio_financeiro_' + new Date().toISOString().split('T')[0] + '.xlsx');
        alert('Relatório financeiro exportado com sucesso!');
    };

    window.exportarFinanceiroPDF = function () {
        var doc = new window.jspdf.jsPDF('p', 'mm', 'a4');
        doc.setFontSize(16);
        doc.text('Relatório Financeiro', 105, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.text('Gerado em: ' + new Date().toLocaleString('pt-BR'), 105, 28, { align: 'center' });

        var items = getDadosFinanceiros();

        var filtrados = items.filter(function (item) {
            if (filtrosFinanceiro.dataInicio) {
                var partes = item.data.split('/');
                var dataItem = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataInicio = new Date(filtrosFinanceiro.dataInicio);
                if (dataItem < dataInicio) return false;
            }
            if (filtrosFinanceiro.dataFim) {
                var partes = item.data.split('/');
                var dataItem = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataFim = new Date(filtrosFinanceiro.dataFim);
                dataFim.setHours(23, 59, 59);
                if (dataItem > dataFim) return false;
            }
            if (filtrosFinanceiro.clienteId) {
                if (String(item.clienteId) !== String(filtrosFinanceiro.clienteId)) return false;
            }
            if (filtrosFinanceiro.tipo) {
                if (item.tipo !== filtrosFinanceiro.tipo) return false;
            }
            return true;
        });

        var totalFaturado = filtrados.reduce(function (sum, item) { return sum + item.valor; }, 0);

        doc.setFontSize(12);
        doc.text('Resumo Financeiro', 20, 40);
        doc.setFontSize(10);
        doc.text('Total Faturado: ' + formatCurrency(totalFaturado), 20, 48);
        doc.text('Total de Itens: ' + filtrados.length, 20, 55);
        doc.text('Clientes Atendidos: ' + new Set(filtrados.map(function (item) { return item.clienteId; })).size, 20, 62);

        var data = filtrados.map(function (item) {
            return [
                item.data,
                getClienteNome(item.clienteId),
                item.tipo,
                item.descricao,
                formatCurrency(item.valor),
                item.status
            ];
        });

        if (data.length > 0) {
            doc.autoTable({
                startY: 70,
                head: [['Data', 'Cliente', 'Tipo', 'Descrição', 'Valor', 'Status']],
                body: data,
                theme: 'striped',
                headStyles: { fillColor: [11, 42, 59] },
                styles: { fontSize: 7 },
                columnStyles: {
                    3: { cellWidth: 40 },
                    4: { cellWidth: 30 }
                }
            });
        } else {
            doc.text('Nenhum dado encontrado com os filtros aplicados.', 20, 75);
        }

        doc.save('relatorio_financeiro_' + new Date().toISOString().split('T')[0] + '.pdf');
        alert('Relatório financeiro exportado com sucesso!');
    };

    window.gerarRelatorioFinanceiroCompleto = function () {
        var items = getDadosFinanceiros();

        var filtrados = items.filter(function (item) {
            if (filtrosFinanceiro.dataInicio) {
                var partes = item.data.split('/');
                var dataItem = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataInicio = new Date(filtrosFinanceiro.dataInicio);
                if (dataItem < dataInicio) return false;
            }
            if (filtrosFinanceiro.dataFim) {
                var partes = item.data.split('/');
                var dataItem = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
                var dataFim = new Date(filtrosFinanceiro.dataFim);
                dataFim.setHours(23, 59, 59);
                if (dataItem > dataFim) return false;
            }
            if (filtrosFinanceiro.clienteId) {
                if (String(item.clienteId) !== String(filtrosFinanceiro.clienteId)) return false;
            }
            if (filtrosFinanceiro.tipo) {
                if (item.tipo !== filtrosFinanceiro.tipo) return false;
            }
            return true;
        });

        var totalFaturado = filtrados.reduce(function (sum, item) { return sum + item.valor; }, 0);
        var totalServicos = filtrados.filter(function (item) { return item.fonte === 'servico'; }).length;
        var totalOS = filtrados.filter(function (item) { return item.fonte === 'os'; }).length;
        var clientesAtendidos = new Set(filtrados.map(function (item) { return item.clienteId; })).size;
        var ticketMedio = filtrados.length > 0 ? totalFaturado / filtrados.length : 0;

        var relatorio = '============================================\n';
        relatorio += 'RELATÓRIO FINANCEIRO COMPLETO\n';
        relatorio += '============================================\n\n';
        relatorio += 'Data de emissão: ' + new Date().toLocaleString('pt-BR') + '\n\n';
        relatorio += '--- RESUMO ---\n';
        relatorio += 'Total Faturado: ' + formatCurrency(totalFaturado) + '\n';
        relatorio += 'Total de Serviços: ' + totalServicos + '\n';
        relatorio += 'Total de OS: ' + totalOS + '\n';
        relatorio += 'Clientes Atendidos: ' + clientesAtendidos + '\n';
        relatorio += 'Ticket Médio: ' + formatCurrency(ticketMedio) + '\n\n';

        var tipoData = {};
        filtrados.forEach(function (item) {
            if (!tipoData[item.tipo]) {
                tipoData[item.tipo] = { count: 0, valor: 0 };
            }
            tipoData[item.tipo].count++;
            tipoData[item.tipo].valor += item.valor;
        });

        relatorio += '--- FATURAMENTO POR TIPO ---\n';
        Object.entries(tipoData).forEach(function (entry) {
            var tipo = entry[0];
            var data = entry[1];
            relatorio += tipo + ': ' + data.count + ' itens - ' + formatCurrency(data.valor) + '\n';
        });

        relatorio += '\n--- DETALHAMENTO ---\n';
        filtrados.forEach(function (item) {
            relatorio += item.data + ' | ' + getClienteNome(item.clienteId) + ' | ' + item.tipo + ' | ' + item.descricao + ' | ' + formatCurrency(item.valor) + ' | ' + item.status + '\n';
        });

        relatorio += '\n============================================\n';
        relatorio += 'Fim do relatório\n';
        relatorio += '============================================\n';

        abrirModal('📊 Relatório Financeiro Completo', `
            <div style="background:#f8fbfd;padding:16px;border-radius:8px;font-family:monospace;white-space:pre-wrap;font-size:0.85rem;max-height:500px;overflow-y:auto;">
                ${relatorio}
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="fecharModal()">Fechar</button>
                <button class="btn-primary" onclick="baixarRelatorioFinanceiroTexto()"><i class="fas fa-download"></i> Baixar</button>
            </div>
        `);

        window._relatorioFinanceiroTexto = relatorio;
    };

    window.baixarRelatorioFinanceiroTexto = function () {
        if (!window._relatorioFinanceiroTexto) return;
        var blob = new Blob([window._relatorioFinanceiroTexto], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'relatorio_financeiro_' + new Date().toISOString().split('T')[0] + '.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // =============================================
    // ===== FUNÇÕES DE ORDEM DE SERVIÇO =====
    // =============================================

    window.visualizarOS = function (id) {
        var os = DB.getById('ordens', id);
        if (!os) {
            alert('Ordem de Serviço não encontrada!');
            return;
        }

        var cliente = getCliente(os.clienteId);

        var servicosExecutados = os.servicosExecutados || [];
        var pragasAlvo = os.pragasAlvo || [];
        var metodosEmpregados = os.metodosEmpregados || [];
        var inseticidasUtilizados = os.inseticidasUtilizados || [];
        var areaLiberada = os.areaLiberada || '';
        var assinaturaOperador = os.assinaturaOperador;
        var assinaturaCliente = os.assinaturaCliente;

        var titleEl = document.getElementById('modalOSTitle');
        var bodyEl = document.getElementById('modalOSBody');
        if (titleEl) titleEl.textContent = 'Ordem de Serviço ' + os.numero;
        if (bodyEl) {
            bodyEl.innerHTML = `
                <div style="margin-bottom:16px;padding:12px;background:#f8fbfd;border-radius:8px;border-left:4px solid #0b2a3b;">
                    <div style="display:flex;flex-wrap:wrap;gap:8px 20px;">
                        <span><strong>Cliente:</strong> ${cliente ? cliente.nome : 'N/A'}</span>
                        <span><strong>Documento:</strong> ${cliente ? cliente.documento || 'N/A' : 'N/A'}</span>
                        <span><strong>Telefone:</strong> ${cliente ? cliente.telefone : 'N/A'}</span>
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:4px;">
                        <span><strong>Data:</strong> ${os.data}</span>
                        <span><strong>Status:</strong> ${getStatusBadge(os.status)}</span>
                    </div>
                </div>
                
                <h4 style="margin:16px 0 8px;color:#0b2a3b;">Serviços Executados</h4>
                <div class="checkbox-grid">
                    ${gerarCheckboxes(SERVICOS_LIST, servicosExecutados, 'servico-check', true)}
                </div>
                
                <h4 style="margin:16px 0 8px;color:#0b2a3b;">Pragas Alvo</h4>
                <div class="checkbox-grid">
                    ${gerarCheckboxes(PRAGAS_LIST, pragasAlvo, 'praga-check', true)}
                </div>
                
                <h4 style="margin:16px 0 8px;color:#0b2a3b;">Métodos Empregados</h4>
                <div class="checkbox-grid">
                    ${gerarCheckboxes(METODOS_LIST, metodosEmpregados, 'metodo-check', true)}
                </div>
                
                <h4 style="margin:16px 0 8px;color:#0b2a3b;">Inseticidas Utilizados</h4>
                ${inseticidasUtilizados.length > 0 ? `
                    <div class="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Produto</th>
                                    <th>Reg. MS</th>
                                    <th>G. Químico</th>
                                    <th>P. Ativo</th>
                                    <th>%</th>
                                    <th>Quantidade</th>
                                    <th>Tratamento</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${inseticidasUtilizados.map(ins => `
                                    <tr>
                                        <td>${ins.nome}</td>
                                        <td>${ins.registro || 'N/A'}</td>
                                        <td>${ins.gQuimico || '-'}</td>
                                        <td>${ins.pAtivo || '-'}</td>
                                        <td>${ins.porcentagem || '-'}</td>
                                        <td>${ins.quantidade} ${ins.unidade || ''}</td>
                                        <td>${ins.tratamento || 'Aplicação'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<p style="color:#999;">Nenhum inseticida utilizado</p>'}
                
                ${areaLiberada ? `
                    <div style="margin-top:16px;padding:12px 16px;background:#f0f7fc;border-radius:12px;border-left:4px solid #1d7a6b;">
                        <strong style="color:#0b2a3b;">Área Liberada:</strong>
                        <p style="color:#4d687a;margin-top:4px;">${areaLiberada}</p>
                    </div>
                ` : ''}
                
                ${os.observacoes ? `
                    <div style="margin-top:16px;padding:12px 16px;background:#f8fbfd;border-radius:12px;border-left:4px solid #0b2a3b;">
                        <strong style="color:#0b2a3b;">Observações:</strong>
                        <p style="color:#4d687a;margin-top:4px;">${os.observacoes}</p>
                    </div>
                ` : ''}

                <div style="margin-top:16px;padding:12px;background:#f8fbfd;border-radius:8px;border-left:4px solid #8e44ad;">
                    <h4 style="color:#0b2a3b;margin-bottom:8px;">
                        <i class="fas fa-pen"></i> Assinaturas
                    </h4>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <strong>Operador:</strong>
                            ${assinaturaOperador ?
                    `<div style="margin-top:4px;border:1px solid #e8eff5;border-radius:4px;overflow:hidden;max-width:200px;">
                                    <img src="${assinaturaOperador}" style="width:100%;height:auto;" alt="Assinatura Operador" />
                                </div>` :
                    '<span style="color:#999;">Não assinado</span>'
                }
                        </div>
                        <div>
                            <strong>Cliente:</strong>
                            ${assinaturaCliente ?
                    `<div style="margin-top:4px;border:1px solid #e8eff5;border-radius:4px;overflow:hidden;max-width:200px;">
                                    <img src="${assinaturaCliente}" style="width:100%;height:auto;" alt="Assinatura Cliente" />
                                </div>` :
                    '<span style="color:#999;">Não assinado</span>'
                }
                        </div>
                    </div>
                </div>
                
                <div style="margin-top:20px;display:flex;gap:12px;justify-content:flex-end;border-top:1px solid #e8eff5;padding-top:20px;">
                    <button class="btn-secondary" onclick="fecharModalOS()">Fechar</button>
                    <button class="btn-primary" onclick="imprimirOS(${os.id})"><i class="fas fa-print"></i> Imprimir</button>
                    <button class="btn-primary" style="background:#8e44ad;" onclick="fecharModalOS();abrirAssinaturaOS(${os.id})">
                        <i class="fas fa-pen"></i> Assinar
                    </button>
                </div>
            `;
        }
        var overlay = document.getElementById('modalOSOverlay');
        if (overlay) overlay.classList.add('active');
    };

    window.fecharModalOS = function () {
        var overlay = document.getElementById('modalOSOverlay');
        if (overlay) overlay.classList.remove('active');
    };

    var modalOSClose = document.getElementById('modalOSClose');
    if (modalOSClose) modalOSClose.addEventListener('click', fecharModalOS);
    var modalOSOverlay = document.getElementById('modalOSOverlay');
    if (modalOSOverlay) {
        modalOSOverlay.addEventListener('click', function (e) {
            if (e.target === this) fecharModalOS();
        });
    }

    // =============================================
    // ===== ADICIONAR INSETICIDA =====
    // =============================================
    window.adicionarInseticida = function () {
        var container = document.getElementById('inseticidasContainer');
        if (!container) return;

        var produtos = DB.getAll('estoque').filter(function (p) { return p.quantidade > 0; });
        var options = produtos.map(function (p) {
            return '<option value="' + p.id + '">' + p.nome + ' (' + p.categoria + ' - ' + p.quantidade + ' ' + p.unidade + ')</option>';
        }).join('');

        var div = document.createElement('div');
        div.className = 'form-row inseticida-row';
        div.innerHTML = `
            <div class="form-group" style="flex:2;">
                <label>Produto</label>
                <select class="ins-produto">
                    <option value="">Selecione...</option>
                    ${options}
                </select>
            </div>
            <div class="form-group" style="flex:0.8;">
                <label>Reg. MS</label>
                <input type="text" class="ins-registro" />
            </div>
            <div class="form-group" style="flex:0.8;">
                <label>G. Químico</label>
                <input type="text" class="ins-quimico" />
            </div>
            <div class="form-group" style="flex:0.8;">
                <label>P. Ativo</label>
                <input type="text" class="ins-ativo" />
            </div>
            <div class="form-group" style="flex:0.6;">
                <label>%</label>
                <input type="text" class="ins-porcentagem" />
            </div>
            <div class="form-group" style="flex:0.8;">
                <label>Quantidade</label>
                <input type="number" class="ins-quantidade" value="1" min="0" step="0.1" />
            </div>
            <div class="form-group" style="flex:1;">
                <label>Tratamento</label>
                <input type="text" class="ins-tratamento" value="Aplicação" />
            </div>
            <div style="display:flex;align-items:flex-end;padding-bottom:6px;">
                <button type="button" class="btn-danger btn-sm" onclick="removerInseticida(this)"><i class="fas fa-times"></i></button>
            </div>
        `;
        container.appendChild(div);
    };

    window.removerInseticida = function (btn) {
        var row = btn?.closest('.inseticida-row');
        if (row && document.querySelectorAll('.inseticida-row').length > 1) {
            row.remove();
        } else {
            alert('Mantenha pelo menos um item.');
        }
    };

    // =============================================
    // ===== CRIAR NOVA OS =====
    // =============================================
    window.criarNovaOS = function () {
        var clienteId = parseInt(document.getElementById('modalOSCliente')?.value || '0');
        var data = document.getElementById('modalOSData')?.value?.split('-').reverse().join('/') || '';
        var dataEntrega = document.getElementById('modalOSEntrega')?.value ?
            document.getElementById('modalOSEntrega').value.split('-').reverse().join('/') : '';
        var status = document.getElementById('modalOSStatus')?.value || 'Pendente';
        var observacoes = document.getElementById('modalOSObs')?.value || '';
        var areaLiberada = document.getElementById('modalOSAreaLiberada')?.value || '';
        var garantia = document.getElementById('modalOSGarantia')?.value || '';
        var numero = gerarNumeroOS();

        var servicosExecutados = [];
        document.querySelectorAll('.servico-check:checked').forEach(function (el) {
            servicosExecutados.push(el.value);
        });

        var pragasAlvo = [];
        document.querySelectorAll('.praga-check:checked').forEach(function (el) {
            pragasAlvo.push(el.value);
        });

        var metodosEmpregados = [];
        document.querySelectorAll('.metodo-check:checked').forEach(function (el) {
            metodosEmpregados.push(el.value);
        });

        var inseticidasUtilizados = [];
        document.querySelectorAll('.inseticida-row').forEach(function (row) {
            var select = row.querySelector('.ins-produto');
            var produtoId = select ? parseInt(select.value) : null;
            if (produtoId) {
                var produto = DB.getById('estoque', produtoId);
                inseticidasUtilizados.push({
                    id: produtoId,
                    nome: produto ? produto.nome : '',
                    unidade: produto ? produto.unidade : '',
                    registro: row.querySelector('.ins-registro')?.value || '',
                    gQuimico: row.querySelector('.ins-quimico')?.value || '',
                    pAtivo: row.querySelector('.ins-ativo')?.value || '',
                    porcentagem: row.querySelector('.ins-porcentagem')?.value || '',
                    quantidade: parseFloat(row.querySelector('.ins-quantidade')?.value) || 0,
                    tratamento: row.querySelector('.ins-tratamento')?.value || 'Aplicação'
                });
            }
        });

        if (inseticidasUtilizados.length === 0) {
            alert('Adicione pelo menos um inseticida à OS.');
            return;
        }

        var produtosInsuficientes = [];
        inseticidasUtilizados.forEach(function (ins) {
            if (ins.id && ins.quantidade > 0) {
                var produto = DB.getById('estoque', ins.id);
                if (produto && produto.quantidade < ins.quantidade) {
                    produtosInsuficientes.push(produto.nome + ' (disponível: ' + produto.quantidade + ' ' + produto.unidade + ', necessário: ' + ins.quantidade + ')');
                }
            }
        });

        if (produtosInsuficientes.length > 0) {
            alert('Estoque insuficiente para:\n' + produtosInsuficientes.join('\n'));
            return;
        }

        var movimentacoesRegistradas = [];
        inseticidasUtilizados.forEach(function (ins) {
            if (ins.id && ins.quantidade > 0) {
                var produto = DB.getById('estoque', ins.id);
                if (produto) {
                    var novaQuantidade = Math.max(0, produto.quantidade - ins.quantidade);
                    DB.update('estoque', ins.id, {
                        quantidade: novaQuantidade,
                        ultimaMovimentacao: new Date().toLocaleDateString('pt-BR')
                    });

                    var mov = {
                        produtoId: ins.id,
                        tipo: 'saida',
                        quantidade: ins.quantidade,
                        data: new Date().toLocaleString('pt-BR'),
                        motivo: 'OS ' + numero,
                        observacao: 'Uso em Ordem de Serviço ' + numero + ' - Cliente: ' + getClienteNome(clienteId),
                        usuario: 'Admin',
                        estoqueAnterior: produto.quantidade,
                        estoqueAtual: novaQuantidade
                    };
                    DB.add('movimentacoes', mov);
                    movimentacoesRegistradas.push(mov);
                }
            }
        });

        var itens = inseticidasUtilizados.map(function (ins) {
            return {
                descricao: ins.nome,
                quantidade: ins.quantidade,
                valorUnitario: 0,
                inseticidaId: ins.id
            };
        });

        var valorTotal = inseticidasUtilizados.reduce(function (sum, ins) { return sum + (ins.quantidade * 0); }, 0);

        DB.add('ordens', {
            numero: numero, clienteId: clienteId, data: data, dataEntrega: dataEntrega, status: status,
            observacoes: observacoes, areaLiberada: areaLiberada, garantia: garantia,
            servicosExecutados: servicosExecutados, pragasAlvo: pragasAlvo,
            metodosEmpregados: metodosEmpregados, inseticidasUtilizados: inseticidasUtilizados,
            itens: itens,
            movimentacoes: movimentacoesRegistradas,
            servicoId: null,
            valorTotal: valorTotal,
            assinaturaOperador: null,
            assinaturaCliente: null,
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString()
        });

        fecharModal();
        renderAll();
        alert('OS ' + numero + ' criada com sucesso! ' + movimentacoesRegistradas.length + ' produto(s) baixado(s) do estoque.');
    };

    // =============================================
    // ===== FUNÇÃO CRIAR NOVO SERVIÇO (CORRIGIDA - SEM DUPLICAÇÃO) =====
    // =============================================
    window.criarNovoServico = function () {
        var clienteId = parseInt(document.getElementById('modalClienteId')?.value || '0');
        var tipo = document.getElementById('modalTipo')?.value || 'Desratização';
        var data = document.getElementById('modalData')?.value?.split('-').reverse().join('/') || '';
        var horario = document.getElementById('modalHorario')?.value || '09:00';
        var status = document.getElementById('modalStatus')?.value || 'Agendado';
        var valor = parseFloat(document.getElementById('modalValor')?.value) || 0;

        if (!clienteId || !data || !tipo) {
            alert('Preencha todos os campos obrigatórios!');
            return;
        }


        var servicosExistentes = DB.getAll('servicos');
        var servicoExistente = servicosExistentes.find(function (s) {
            return String(s.clienteId) === String(clienteId) &&
                s.data === data &&
                s.tipo === tipo &&
                (s.status === status || s.status === 'Agendado');
        });

        if (servicoExistente) {
            console.warn('⚠️ Serviço já existe, atualizando em vez de criar novo:', servicoExistente.id);
            DB.update('servicos', servicoExistente.id, {
                status: status,
                valor: valor,
                horario: horario,
                atualizadoEm: new Date().toISOString()
            });

            sincronizarServicoComAgenda(servicoExistente, 'update');
            sincronizarServicoComOS(servicoExistente, 'update');

            fecharModal();
            renderAll();
            alert('✅ Serviço #' + String(servicoExistente.id).padStart(3, '0') + ' atualizado para: ' + status);
            return;
        }

        var servico = DB.add('servicos', {
            clienteId: clienteId,
            tipo: tipo,
            data: data,
            status: status,
            valor: valor,
            horario: horario,
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString()
        });


        var cliente = getCliente(clienteId);
        var clienteNome = cliente ? cliente.nome : 'Cliente #' + clienteId;

        var statusMap = {
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
        var statusInfo = statusMap[status] || { emoji: '📌', label: status };
        var valorFormatado = valor ? valor.toFixed(2).replace('.', ',') : '0,00';
        var descricao = 'Serviço #' + String(servico.id).padStart(3, '0') + ': ' + tipo + ' - ' + statusInfo.emoji + ' ' + statusInfo.label + ' (R$ ' + valorFormatado + ')';

        var agendaKey = DB.getFullKey('agenda');
        var agendaItems = JSON.parse(localStorage.getItem(agendaKey) || '[]');
        var agendamentoExistente = agendaItems.find(function (a) {
            return a.servicoId === servico.id;
        });

        if (agendamentoExistente) {
            console.warn('⚠️ Agendamento já existe para o serviço #' + servico.id + ', atualizando...');
            var index = agendaItems.findIndex(function (a) { return a.id === agendamentoExistente.id; });
            if (index !== -1) {
                agendaItems[index] = {
                    ...agendamentoExistente,
                    data: data,
                    horario: horario,
                    descricao: descricao,
                    statusServico: status,
                    tipoServico: tipo,
                    clienteNome: clienteNome,
                    atualizadoEm: new Date().toISOString()
                };
                localStorage.setItem(agendaKey, JSON.stringify(agendaItems));
            }
        } else {
            var maxId = agendaItems.reduce(function (max, a) {
                var id = typeof a.id === 'number' ? a.id : parseInt(a.id) || 0;
                return Math.max(max, id);
            }, 0);
            var novoId = maxId + 1;

            var novoAgendamento = {
                id: novoId,
                clienteId: clienteId,
                data: data,
                horario: horario,
                descricao: descricao,
                servicoId: servico.id,
                statusServico: status,
                tipoServico: tipo,
                sincronizado: true,
                clienteNome: clienteNome,
                criadoEm: new Date().toISOString(),
                atualizadoEm: new Date().toISOString()
            };

            agendaItems.push(novoAgendamento);
            localStorage.setItem(agendaKey, JSON.stringify(agendaItems));
        }

        sincronizarServicoComOS(servico, 'add');

        if (status === 'Concluído' || status === 'Concluida' || status === 'Concluída') {
            verificarCertificadoAutomatico(servico);
        }

        DB.forceClearCache('agenda');
        DB._clearAllCaches();

        fecharModal();
        renderAll();

        setTimeout(function () {
            renderAll();
        }, 200);

        alert('✅ Serviço #' + String(servico.id).padStart(3, '0') + ' criado com status: ' + status);
    };

    // =============================================
    // ===== FUNÇÃO SALVAR EDIÇÃO DO SERVIÇO =====
    // =============================================
    window.salvarEdicaoServico = function (id) {
        var clienteId = parseInt(document.getElementById('modalClienteId')?.value || '0');
        var tipo = document.getElementById('modalTipo')?.value || 'Desratização';
        var data = document.getElementById('modalData')?.value?.split('-').reverse().join('/') || '';
        var horario = document.getElementById('modalHorario')?.value || '09:00';
        var status = document.getElementById('modalStatus')?.value || 'Agendado';
        var valor = parseFloat(document.getElementById('modalValor')?.value) || 0;

        var servicoAntigo = DB.getById('servicos', id);
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

        var servicoAtualizado = DB.getById('servicos', id);

        var agendaKey = DB.getFullKey('agenda');
        var agendaItems = JSON.parse(localStorage.getItem(agendaKey) || '[]');
        var agendamentoExistente = agendaItems.find(function (a) {
            return a.servicoId === id;
        });

        if (agendamentoExistente) {
            var cliente = getCliente(clienteId);
            var clienteNome = cliente ? cliente.nome : 'Cliente #' + clienteId;

            var statusMap = {
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
            var statusInfo = statusMap[status] || { emoji: '📌', label: status };
            var valorFormatado = valor ? valor.toFixed(2).replace('.', ',') : '0,00';
            var descricao = 'Serviço #' + String(id).padStart(3, '0') + ': ' + tipo + ' - ' + statusInfo.emoji + ' ' + statusInfo.label + ' (R$ ' + valorFormatado + ')';

            var index = agendaItems.findIndex(function (a) { return a.id === agendamentoExistente.id; });
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
            }
        } else {
            sincronizarServicoComAgenda(servicoAtualizado, 'add', servicoAntigo);
        }

        sincronizarServicoComOS(servicoAtualizado, 'update');

        if (status === 'Concluído' || status === 'Concluida' || status === 'Concluída') {
            verificarCertificadoAutomatico(servicoAtualizado);
        }

        DB.forceClearCache('agenda');
        DB._clearAllCaches();

        fecharModal();
        renderAll();

        setTimeout(function () {
            renderAll();
        }, 300);

        alert('✅ Serviço #' + String(id).padStart(3, '0') + ' atualizado para: ' + status);
    };

    window.excluirServico = function (id) {
        if (!confirm('Tem certeza que deseja excluir este serviço?')) {
            return;
        }

        var servico = DB.getById('servicos', id);
        if (!servico) return;

        var agendaKey = DB.getFullKey('agenda');
        var agenda = JSON.parse(localStorage.getItem(agendaKey) || '[]');
        var agendamentoRelacionado = agenda.find(function (a) { return a.servicoId === id; });
        if (agendamentoRelacionado) {
            var novaAgenda = agenda.filter(function (a) { return a.id !== agendamentoRelacionado.id; });
            localStorage.setItem(agendaKey, JSON.stringify(novaAgenda));
        }

        var ordens = DB.getAll('ordens');
        var osRelacionada = ordens.find(function (o) { return o.servicoId === id; });
        if (osRelacionada) {
            DB.update('ordens', osRelacionada.id, {
                servicoId: null,
                status: 'Cancelada',
                atualizadoEm: new Date().toISOString()
            });
        }

        DB.remove('servicos', id);
        DB._clearAllCaches();
        DB.forceClearCache('agenda');
        renderAll();

        setTimeout(function () {
            renderAll();
        }, 200);

        alert('✅ Serviço removido com sucesso!');
    };

    // =============================================
    // ===== FUNÇÃO DE DIAGNÓSTICO =====
    // =============================================
    window.diagnosticarAgenda = function () {

        var servicos = DB.getAll('servicos');
        var agendaKey = DB.getFullKey('agenda');
        var agenda = JSON.parse(localStorage.getItem(agendaKey) || '[]');


        servicos.forEach(function (s) {
            var agendamento = agenda.find(function (a) { return a.servicoId === s.id; });
            if (agendamento) {
            } else {
            }
        });

    };

    window.forcarRecriarAgenda = function () {
        if (!confirm('⚠️ Isso irá recriar TODOS os agendamentos baseados nos status atuais dos serviços.\n\nTem certeza?')) {
            return;
        }

        var servicos = DB.getAll('servicos');
        var agendaItems = [];
        var agendaKey = DB.getFullKey('agenda');

        servicos.forEach(function (servico) {
            var cliente = getCliente(servico.clienteId);
            var clienteNome = cliente ? cliente.nome : 'Cliente #' + servico.clienteId;

            var statusMap = {
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

            var statusInfo = statusMap[servico.status] || { emoji: '📌', label: servico.status };
            var valorFormatado = servico.valor ? servico.valor.toFixed(2).replace('.', ',') : '0,00';
            var tiposStr = servico.tipos && servico.tipos.length > 0 ? servico.tipos.join(' + ') : servico.tipo;
            var descricao = 'Serviço #' + String(servico.id).padStart(3, '0') + ': ' + tiposStr + ' - ' + statusInfo.emoji + ' ' + statusInfo.label + ' (R$ ' + valorFormatado + ')';
            var horario = servico.horario || '09:00';

            agendaItems.push({
                id: servico.id + 1000,
                clienteId: servico.clienteId,
                data: servico.data,
                horario: horario,
                descricao: descricao,
                servicoId: servico.id,
                statusServico: servico.status,
                tipoServico: servico.tipo,
                tiposServico: servico.tipos || [servico.tipo],
                sincronizado: true,
                clienteNome: clienteNome,
                criadoEm: new Date().toISOString(),
                atualizadoEm: new Date().toISOString()
            });
        });

        localStorage.setItem(agendaKey, JSON.stringify(agendaItems));
        DB.forceClearCache('agenda');
        DB._clearAllCaches();

        renderAll();
        alert('✅ Agenda recriada com sucesso! ' + agendaItems.length + ' agendamentos gerados.');
    };

    // =============================================
    // ===== FUNÇÕES DE ESTOQUE (continuação) =====
    // =============================================

    window.editarProduto = function (id) {
        var p = DB.getById('estoque', id);
        if (!p) return;

        abrirModal('Editar Produto', `
            <div class="form-row">
                <div class="form-group">
                    <label>Código</label>
                    <input type="text" id="modalProdutoCodigo" value="${p.codigo}" />
                </div>
                <div class="form-group">
                    <label>Nome do Produto *</label>
                    <input type="text" id="modalProdutoNome" value="${p.nome}" />
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Categoria</label>
                    <select id="modalProdutoCategoria">
                        ${['Inseticidas', 'Rodenticidas', 'Equipamentos', 'EPI', 'Outros'].map(c =>
            `<option value="${c}" ${c === p.categoria ? 'selected' : ''}>${c}</option>`
        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Unidade</label>
                    <select id="modalProdutoUnidade">
                        ${['un', 'kg', 'g', 'l', 'ml', 'par', 'cx'].map(u =>
            `<option value="${u}" ${u === p.unidade ? 'selected' : ''}>${u}</option>`
        ).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Quantidade</label>
                    <input type="number" id="modalProdutoQtd" value="${p.quantidade}" min="0" />
                </div>
                <div class="form-group">
                    <label>Estoque Mínimo *</label>
                    <input type="number" id="modalProdutoMinimo" value="${p.minimo}" min="0" />
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Valor de Custo (R$)</label>
                    <input type="number" id="modalProdutoCusto" value="${p.valorCusto || 0}" step="0.01" min="0" />
                </div>
                <div class="form-group">
                    <label>Valor de Venda (R$)</label>
                    <input type="number" id="modalProdutoVenda" value="${p.valorVenda || 0}" step="0.01" min="0" />
                </div>
            </div>
            <div class="form-group">
                <label>Localização</label>
                <input type="text" id="modalProdutoLocalizacao" value="${p.localizacao || ''}" />
            </div>
            <div class="form-group">
                <label>Fornecedor</label>
                <input type="text" id="modalProdutoFornecedor" value="${p.fornecedor || ''}" />
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="fecharModal()">Cancelar</button>
                <button class="btn-primary" onclick="salvarProduto(${id})">Salvar</button>
            </div>
        `);
    };

    window.salvarProduto = function (id) {
        var codigo = document.getElementById('modalProdutoCodigo')?.value || '';
        var nome = document.getElementById('modalProdutoNome')?.value || '';
        var categoria = document.getElementById('modalProdutoCategoria')?.value || 'Outros';
        var unidade = document.getElementById('modalProdutoUnidade')?.value || 'un';
        var quantidade = parseInt(document.getElementById('modalProdutoQtd')?.value) || 0;
        var minimo = parseInt(document.getElementById('modalProdutoMinimo')?.value) || 0;
        var valorCusto = parseFloat(document.getElementById('modalProdutoCusto')?.value) || 0;
        var valorVenda = parseFloat(document.getElementById('modalProdutoVenda')?.value) || 0;
        var localizacao = document.getElementById('modalProdutoLocalizacao')?.value || '';
        var fornecedor = document.getElementById('modalProdutoFornecedor')?.value || '';

        if (!nome) {
            alert('Nome do produto é obrigatório!');
            return;
        }

        DB.update('estoque', id, {
            codigo: codigo, nome: nome, categoria: categoria, unidade: unidade, quantidade: quantidade, minimo: minimo,
            valorCusto: valorCusto, valorVenda: valorVenda, localizacao: localizacao, fornecedor: fornecedor,
            ultimaMovimentacao: new Date().toLocaleDateString('pt-BR')
        });

        fecharModal();
        renderAll();
        alert('Produto atualizado com sucesso!');
    };

    window.excluirProduto = function (id) {
        var p = DB.getById('estoque', id);
        if (!p) return;

        if (confirm('Tem certeza que deseja excluir "' + p.nome + '"?')) {
            DB.remove('estoque', id);
            renderAll();
            alert('Produto excluído!');
        }
    };

    window.movimentarEstoque = function (id, tipo) {
        var p = DB.getById('estoque', id);
        if (!p) return;

        var titulo = tipo === 'entrada' ? 'Entrada de Estoque' : 'Saída de Estoque';
        var icon = tipo === 'entrada' ? '⬇️' : '⬆️';
        var cor = tipo === 'entrada' ? '#1d7a6b' : '#b13e3a';

        abrirModal(titulo, `
            <div style="background:#f8fbfd;padding:16px;border-radius:12px;margin-bottom:16px;">
                <div><strong>Produto:</strong> ${p.nome}</div>
                <div><strong>Código:</strong> ${p.codigo}</div>
                <div><strong>Estoque Atual:</strong> ${p.quantidade} ${p.unidade}</div>
            </div>
            <div class="form-group">
                <label>Quantidade *</label>
                <input type="number" id="modalMovQtd" value="1" min="${tipo === 'saida' ? 1 : 0}" step="1" />
            </div>
            <div class="form-group">
                <label>Motivo *</label>
                <select id="modalMovMotivo">
                    ${tipo === 'entrada' ? `
                        <option value="Compra">Compra</option>
                        <option value="Devolução">Devolução</option>
                        <option value="Ajuste">Ajuste de Estoque</option>
                        <option value="Transferência">Transferência</option>
                    ` : `
                        <option value="OS">Ordem de Serviço</option>
                        <option value="Consumo">Consumo Interno</option>
                        <option value="Devolução">Devolução ao Fornecedor</option>
                        <option value="Ajuste">Ajuste de Estoque</option>
                    `}
                </select>
            </div>
            <div class="form-group">
                <label>Observação</label>
                <textarea id="modalMovObs" rows="2" placeholder="Detalhes adicionais..."></textarea>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="fecharModal()">Cancelar</button>
                <button class="btn-primary" style="background:${cor};" onclick="confirmarMovimentacao(${id}, '${tipo}')">
                    ${icon} Confirmar ${tipo === 'entrada' ? 'Entrada' : 'Saída'}
                </button>
            </div>
        `);
    };

    window.confirmarMovimentacao = function (id, tipo) {
        var qtd = parseInt(document.getElementById('modalMovQtd')?.value) || 0;
        var motivo = document.getElementById('modalMovMotivo')?.value || 'Ajuste';
        var observacao = document.getElementById('modalMovObs')?.value || '';

        if (qtd <= 0) {
            alert('Quantidade deve ser maior que zero!');
            return;
        }

        var produto = DB.getById('estoque', id);
        if (!produto) return;

        if (tipo === 'saida' && qtd > produto.quantidade) {
            alert('Estoque insuficiente! Disponível: ' + produto.quantidade + ' ' + produto.unidade);
            return;
        }

        var estoqueAnterior = produto.quantidade;
        var novaQuantidade = tipo === 'entrada' ? estoqueAnterior + qtd : estoqueAnterior - qtd;

        DB.update('estoque', id, {
            quantidade: novaQuantidade,
            ultimaMovimentacao: new Date().toLocaleDateString('pt-BR')
        });

        var mov = {
            produtoId: id,
            tipo: tipo,
            quantidade: qtd,
            data: new Date().toLocaleString('pt-BR'),
            motivo: motivo,
            observacao: observacao,
            usuario: 'Admin',
            estoqueAnterior: estoqueAnterior,
            estoqueAtual: novaQuantidade
        };

        DB.add('movimentacoes', mov);

        fecharModal();
        renderAll();
        alert('Movimentação registrada com sucesso! Novo estoque: ' + novaQuantidade + ' ' + produto.unidade);

        if (novaQuantidade <= produto.minimo) {
            alert('⚠️ Alerta: Estoque de "' + produto.nome + '" está baixo! (' + novaQuantidade + ' ' + produto.unidade + ')');
        }
    };

    window.confirmarEntradaRapida = function () {
        var produtoId = parseInt(document.getElementById('modalMovProduto')?.value || '0');
        var qtd = parseInt(document.getElementById('modalMovQtdRapida')?.value) || 0;
        var observacao = document.getElementById('modalMovObsRapida')?.value || '';

        if (qtd <= 0) {
            alert('Quantidade deve ser maior que zero!');
            return;
        }

        var produto = DB.getById('estoque', produtoId);
        if (!produto) return;

        var estoqueAnterior = produto.quantidade;
        var novaQuantidade = estoqueAnterior + qtd;

        DB.update('estoque', produtoId, {
            quantidade: novaQuantidade,
            ultimaMovimentacao: new Date().toLocaleDateString('pt-BR')
        });

        DB.add('movimentacoes', {
            produtoId: produtoId,
            tipo: 'entrada',
            quantidade: qtd,
            data: new Date().toLocaleString('pt-BR'),
            motivo: 'Entrada rápida',
            observacao: observacao || 'Entrada rápida',
            usuario: 'Admin',
            estoqueAnterior: estoqueAnterior,
            estoqueAtual: novaQuantidade
        });

        fecharModal();
        renderAll();
        alert('Entrada registrada! Novo estoque: ' + novaQuantidade + ' ' + produto.unidade);
    };

    window.confirmarSaidaRapida = function () {
        var produtoId = parseInt(document.getElementById('modalMovProdutoSaida')?.value || '0');
        var qtd = parseInt(document.getElementById('modalMovQtdSaida')?.value) || 0;
        var motivo = document.getElementById('modalMovMotivoSaida')?.value || 'OS';
        var observacao = document.getElementById('modalMovObsSaida')?.value || '';

        if (qtd <= 0) {
            alert('Quantidade deve ser maior que zero!');
            return;
        }

        var produto = DB.getById('estoque', produtoId);
        if (!produto) return;

        if (qtd > produto.quantidade) {
            alert('Estoque insuficiente! Disponível: ' + produto.quantidade + ' ' + produto.unidade);
            return;
        }

        var estoqueAnterior = produto.quantidade;
        var novaQuantidade = estoqueAnterior - qtd;

        DB.update('estoque', produtoId, {
            quantidade: novaQuantidade,
            ultimaMovimentacao: new Date().toLocaleDateString('pt-BR')
        });

        DB.add('movimentacoes', {
            produtoId: produtoId,
            tipo: 'saida',
            quantidade: qtd,
            data: new Date().toLocaleString('pt-BR'),
            motivo: motivo || 'Saída rápida',
            observacao: observacao || 'Saída rápida',
            usuario: 'Admin',
            estoqueAnterior: estoqueAnterior,
            estoqueAtual: novaQuantidade
        });

        fecharModal();
        renderAll();
        alert('Saída registrada! Novo estoque: ' + novaQuantidade + ' ' + produto.unidade);
    };

    window.verDetalhesProduto = function (id) {
        var p = DB.getById('estoque', id);
        if (!p) return;

        var movimentacoes = DB.getAll('movimentacoes')
            .filter(function (m) { return m.produtoId === id; })
            .sort(function (a, b) { return new Date(b.data) - new Date(a.data); })
            .slice(0, 10);

        var movHtml = movimentacoes.length > 0 ? movimentacoes.map(function (m) {
            return '<div class="movimentacao-item">' +
                '<span>' + m.data + '</span>' +
                '<span class="tipo ' + m.tipo + '">' + (m.tipo === 'entrada' ? '⬇️ Entrada' : '⬆️ Saída') + '</span>' +
                '<span class="quantidade ' + m.tipo + '">' + m.quantidade + '</span>' +
                '<span><strong>' + (m.motivo || '-') + '</strong></span>' +
                '</div>';
        }).join('') : '<p style="color:#999;text-align:center;">Nenhuma movimentação registrada</p>';

        var statusClass = p.quantidade <= 0 ? 'critico' :
            p.quantidade <= p.minimo ? 'baixo' :
                p.quantidade >= p.minimo * 3 ? 'alto' : 'normal';
        var statusText = p.quantidade <= 0 ? '⚠️ Esgotado' :
            p.quantidade <= p.minimo ? '⚠️ Baixo' :
                p.quantidade >= p.minimo * 3 ? '✅ Alto' : '✅ Normal';

        abrirModal('📦 ' + p.nome, `
            <div class="estoque-detalhes-modal">
                <div class="produto-info">
                    <div class="item">
                        <span class="label">Código</span>
                        <span class="value">${p.codigo}</span>
                    </div>
                    <div class="item">
                        <span class="label">Categoria</span>
                        <span class="value">${p.categoria}</span>
                    </div>
                    <div class="item">
                        <span class="label">Quantidade</span>
                        <span class="value">${p.quantidade} ${p.unidade}</span>
                    </div>
                    <div class="item">
                        <span class="label">Mínimo</span>
                        <span class="value">${p.minimo} ${p.unidade}</span>
                    </div>
                    <div class="item">
                        <span class="label">Status</span>
                        <span class="value"><span class="status-badge ${statusClass}">${statusText}</span></span>
                    </div>
                    <div class="item">
                        <span class="label">Localização</span>
                        <span class="value">${p.localizacao || 'N/A'}</span>
                    </div>
                    <div class="item">
                        <span class="label">Fornecedor</span>
                        <span class="value">${p.fornecedor || 'N/A'}</span>
                    </div>
                    <div class="item">
                        <span class="label">Valor de Venda</span>
                        <span class="value">${p.valorVenda ? formatCurrency(p.valorVenda) : 'N/A'}</span>
                    </div>
                </div>
                
                <h4 style="color:#0b2a3b;margin-bottom:8px;">Últimas Movimentações</h4>
                <div style="background:#f8fbfd;border-radius:8px;padding:8px 12px;max-height:200px;overflow-y:auto;">
                    ${movHtml}
                </div>
                
                <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn-primary btn-sm" style="background:#1d7a6b;" onclick="fecharModal();movimentarEstoque(${id}, 'entrada')">
                        <i class="fas fa-arrow-down"></i> Entrada
                    </button>
                    <button class="btn-primary btn-sm" style="background:#b13e3a;" onclick="fecharModal();movimentarEstoque(${id}, 'saida')">
                        <i class="fas fa-arrow-up"></i> Saída
                    </button>
                    <button class="btn-secondary btn-sm" onclick="fecharModal();editarProduto(${id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                </div>
            </div>
        `);
    };

    // =============================================
    // ===== FUNÇÕES DE RELATÓRIOS =====
    // =============================================
    window.excluirRelatorio = function (id) {
        var r = DB.getById('relatorios', id);
        if (!r) return;

        if (confirm('Tem certeza que deseja excluir o relatório "' + r.titulo + '"? Esta ação não pode ser desfeita.')) {
            DB.remove('relatorios', id);
            renderAll();
            alert('Relatório excluído com sucesso!');
        }
    };

    function preencherCamposRelatorio(modeloId) {
        var modelo = DB.getById('modelos', modeloId);
        var container = document.getElementById('relatorioCamposContainer');
        if (!container) return;

        if (!modelo) {
            container.innerHTML = '<p style="color:#999;">Selecione um modelo</p>';
            return;
        }
        container.innerHTML = modelo.campos.map(function (campo) {
            return '<div class="form-group">' +
                '<label>' + campo.label + '</label>' +
                '<input type="text" class="campo-relatorio-valor" value="' + (campo.valor || '') + '" placeholder="' + campo.label + '" />' +
                '</div>';
        }).join('');
    }

    window.criarRelatorio = function () {
        var titulo = document.getElementById('modalRelatorioTitulo')?.value || '';
        var clienteId = parseInt(document.getElementById('modalRelatorioCliente')?.value || '0');
        var data = document.getElementById('modalRelatorioData')?.value?.split('-').reverse().join('/') || '';
        var modeloId = parseInt(document.getElementById('modalRelatorioModelo')?.value || '0');
        var status = document.getElementById('modalRelatorioStatus')?.value || 'Pendente';
        var gravidade = document.getElementById('modalRelatorioGravidade')?.value || 'Baixa';
        var observacoes = document.getElementById('modalRelatorioObs')?.value || '';

        if (!titulo) {
            alert('Título do relatório é obrigatório!');
            return;
        }

        var campos = [];
        document.querySelectorAll('.campo-relatorio-valor').forEach(function (input) {
            var label = input.previousElementSibling?.textContent?.replace('*', '').trim() || '';
            campos.push({ label: label, valor: input.value });
        });

        var inputImagens = document.getElementById('modalRelatorioImagens');
        var imagens = [];
        if (inputImagens && inputImagens.files && inputImagens.files.length > 0) {
            var carregadas = 0;
            var total = inputImagens.files.length;

            Array.from(inputImagens.files).forEach(function (file) {
                var reader = new FileReader();
                reader.onload = function (e) {
                    imagens.push(e.target.result);
                    carregadas++;
                    if (carregadas === total) {
                        finalizarCriacao();
                    }
                };
                reader.readAsDataURL(file);
            });
        } else {
            finalizarCriacao();
        }

        function finalizarCriacao() {
            var novoRelatorio = DB.add('relatorios', {
                modeloId: modeloId,
                clienteId: clienteId,
                titulo: titulo,
                data: data,
                status: status,
                gravidade: gravidade,
                observacoes: observacoes,
                campos: campos,
                imagens: imagens
            });

            fecharModal();

            document.dispatchEvent(new CustomEvent('relatorioAtualizado', {
                detail: { relatorio: novoRelatorio, action: 'add' }
            }));

            renderAll();
            alert('Relatório criado com sucesso!');
        }
    };

    window.editarRelatorio = function (id) {
        var r = DB.getById('relatorios', id);
        if (!r) return;

        var modelos = DB.getAll('modelos');
        var clientes = DB.getAll('clientes');

        var camposHtml = r.campos.map(function (campo) {
            return '<div class="form-group">' +
                '<label>' + campo.label + '</label>' +
                '<input type="text" class="campo-relatorio-valor" value="' + (campo.valor || '') + '" placeholder="' + campo.label + '" />' +
                '</div>';
        }).join('');

        var imagensHtml = r.imagens && r.imagens.length > 0 ? r.imagens.map(function (img, idx) {
            return '<div style="position:relative;display:inline-block;width:80px;height:80px;border:1px solid #e8eff5;border-radius:8px;overflow:hidden;">' +
                '<img src="' + img + '" style="width:100%;height:100%;object-fit:cover;" />' +
                '<button onclick="removerImagemRelatorio(' + id + ', ' + idx + ')" style="position:absolute;top:2px;right:2px;background:rgba(255,0,0,0.8);color:white;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:12px;">×</button>' +
                '</div>';
        }).join('') : '';

        abrirModal('Editar Relatório', `
            <div class="form-group">
                <label>Título do Relatório</label>
                <input type="text" id="modalRelatorioTitulo" value="${r.titulo}" />
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Cliente</label>
                    <select id="modalRelatorioCliente">
                        ${clientes.map(c => `<option value="${c.id}" ${c.id === r.clienteId ? 'selected' : ''}>${c.nome} (${c.tipoCliente === 'cnpj' ? 'CNPJ' : 'CPF'}: ${c.documento})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Data</label>
                    <input type="date" id="modalRelatorioData" value="${r.data.split('/').reverse().join('-')}" />
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Modelo</label>
                    <select id="modalRelatorioModelo">
                        ${modelos.map(m => `<option value="${m.id}" ${m.id === r.modeloId ? 'selected' : ''}>${m.nome}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="modalRelatorioStatus">
                        <option value="Pendente" ${r.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                        <option value="Em andamento" ${r.status === 'Em andamento' ? 'selected' : ''}>Em andamento</option>
                        <option value="Concluído" ${r.status === 'Concluído' ? 'selected' : ''}>Concluído</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Gravidade</label>
                <select id="modalRelatorioGravidade">
                    <option value="Baixa" ${r.gravidade === 'Baixa' ? 'selected' : ''}>Baixa</option>
                    <option value="Média" ${r.gravidade === 'Média' ? 'selected' : ''}>Média</option>
                    <option value="Alta" ${r.gravidade === 'Alta' ? 'selected' : ''}>Alta</option>
                    <option value="Crítica" ${r.gravidade === 'Crítica' ? 'selected' : ''}>Crítica</option>
                </select>
            </div>
            <div class="form-group">
                <label>Campos do Relatório</label>
                <div id="relatorioCamposContainer">${camposHtml}</div>
            </div>
            <div class="form-group">
                <label>Observações</label>
                <textarea id="modalRelatorioObs" rows="2">${r.observacoes || ''}</textarea>
            </div>
            <div class="form-group">
                <label>Imagens Atuais</label>
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;">
                    ${imagensHtml || '<p style="color:#999;font-size:0.9rem;">Nenhuma imagem</p>'}
                </div>
            </div>
            <div class="form-group">
                <label>Adicionar Imagens</label>
                <input type="file" id="modalRelatorioImagens" accept="image/*" multiple style="padding:8px;" />
                <div id="previewImagens" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;"></div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="fecharModal()">Cancelar</button>
                <button class="btn-primary" onclick="salvarRelatorio(${id})">Salvar</button>
            </div>
        `);

        var inputImagens = document.getElementById('modalRelatorioImagens');
        if (inputImagens) {
            inputImagens.addEventListener('change', function () {
                var preview = document.getElementById('previewImagens');
                if (!preview) return;
                preview.innerHTML = '';
                if (this.files) {
                    Array.from(this.files).forEach(function (file, index) {
                        var reader = new FileReader();
                        reader.onload = function (e) {
                            var div = document.createElement('div');
                            div.style.cssText = 'position:relative;width:80px;height:80px;border:1px solid #e8eff5;border-radius:8px;overflow:hidden;';
                            div.innerHTML = `
                                <img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;" />
                                <span style="position:absolute;bottom:0;right:0;background:rgba(0,0,0,0.7);color:white;font-size:10px;padding:2px 6px;border-radius:4px 0 0 0;">${index + 1}</span>
                            `;
                            preview.appendChild(div);
                        };
                        reader.readAsDataURL(file);
                    });
                }
            });
        }

        var elModelo = document.getElementById('modalRelatorioModelo');
        if (elModelo) {
            elModelo.addEventListener('change', function () {
                preencherCamposRelatorio(parseInt(this.value));
            });
        }
    };

    window.salvarRelatorio = function (id) {
        var titulo = document.getElementById('modalRelatorioTitulo')?.value || '';
        var clienteId = parseInt(document.getElementById('modalRelatorioCliente')?.value || '0');
        var data = document.getElementById('modalRelatorioData')?.value?.split('-').reverse().join('/') || '';
        var modeloId = parseInt(document.getElementById('modalRelatorioModelo')?.value || '0');
        var status = document.getElementById('modalRelatorioStatus')?.value || 'Pendente';
        var gravidade = document.getElementById('modalRelatorioGravidade')?.value || 'Baixa';
        var observacoes = document.getElementById('modalRelatorioObs')?.value || '';

        if (!titulo) {
            alert('Título do relatório é obrigatório!');
            return;
        }

        var campos = [];
        document.querySelectorAll('.campo-relatorio-valor').forEach(function (input) {
            var label = input.previousElementSibling?.textContent?.replace('*', '').trim() || '';
            campos.push({ label: label, valor: input.value });
        });

        var inputImagens = document.getElementById('modalRelatorioImagens');
        if (inputImagens && inputImagens.files && inputImagens.files.length > 0) {
            var imagensAtuais = DB.getById('relatorios', id)?.imagens || [];
            var novasImagens = [];
            var carregadas = 0;
            var total = inputImagens.files.length;

            Array.from(inputImagens.files).forEach(function (file) {
                var reader = new FileReader();
                reader.onload = function (e) {
                    novasImagens.push(e.target.result);
                    carregadas++;
                    if (carregadas === total) {
                        DB.update('relatorios', id, {
                            modeloId: modeloId, clienteId: clienteId, titulo: titulo, data: data, status: status, gravidade: gravidade, observacoes: observacoes, campos: campos,
                            imagens: imagensAtuais.concat(novasImagens)
                        });
                        fecharModal();
                        renderAll();
                        alert('Relatório atualizado com sucesso!');
                    }
                };
                reader.readAsDataURL(file);
            });
        } else {
            DB.update('relatorios', id, { modeloId: modeloId, clienteId: clienteId, titulo: titulo, data: data, status: status, gravidade: gravidade, observacoes: observacoes, campos: campos });
            fecharModal();
            renderAll();
            alert('Relatório atualizado com sucesso!');
        }
    };

    window.removerImagemRelatorio = function (id, index) {
        var r = DB.getById('relatorios', id);
        if (!r) return;
        var novasImagens = r.imagens.filter(function (_, i) { return i !== index; });
        DB.update('relatorios', id, { imagens: novasImagens });
        renderAll();
        editarRelatorio(id);
    };

    window.visualizarRelatorio = function (id) {
        window._relatorioVisualizandoId = id;

        var r = DB.getById('relatorios', id);
        if (!r) {
            alert('Relatório não encontrado!');
            return;
        }

        var cliente = getCliente(r.clienteId);
        var modelo = DB.getById('modelos', r.modeloId);
        var config = DB.getConfig();
        var cor = config.relatorio.cor || '#0b2a3b';

        var clienteInfo = cliente ? cliente.nome : 'N/A';
        var documentoInfo = cliente ? cliente.documento || 'N/A' : 'N/A';
        var tipoInfo = cliente ? (cliente.tipoCliente === 'cnpj' ? '🏢 Pessoa Jurídica (CNPJ)' : '👤 Pessoa Física (CPF)') : 'N/A';

        var camposHtml = r.campos.map(function (campo) {
            return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f4f8;">' +
                '<span style="font-weight:500;color:#0b2a3b;">' + campo.label + ':</span>' +
                '<span style="color:#4d687a;" class="campo-editavel" contenteditable="true" ' +
                'onblur="atualizarCampoRelatorio(' + id + ', \'' + campo.label + '\', this.textContent.trim())">' +
                (campo.valor || '(vazio)') +
                '</span>' +
                '</div>';
        }).join('');

        var imagensHtml = r.imagens && r.imagens.length > 0 ?
            r.imagens.map(function (img) {
                return '<div class="imagem-item">' +
                    '<img src="' + img + '" alt="Imagem do relatório" onclick="window.open(\'' + img + '\',\'_blank\')" style="cursor:pointer;" />' +
                    '<div class="legenda">Imagem ' + (r.imagens.indexOf(img) + 1) + '</div>' +
                    '</div>';
            }).join('') :
            '<p style="color:#999;grid-column:1/-1;text-align:center;">Nenhuma imagem anexada</p>';

        var logoHtml = config.empresa.logo ?
            '<img src="' + config.empresa.logo + '" alt="' + config.empresa.nome + '" />' : '';

        var titleEl = document.getElementById('modalRelatorioTitle');
        var bodyEl = document.getElementById('modalRelatorioBody');
        if (titleEl) titleEl.textContent = r.titulo;
        if (bodyEl) {
            bodyEl.innerHTML = `
                <div class="relatorio-modal-content" style="--cor-principal: ${cor};">
                    <div class="header-empresa">
                        <div class="logo-container">
                            ${logoHtml}
                            <div class="empresa-info">
                                <h1>${config.empresa.nome || 'Click Saúde Ambiental'}</h1>
                                <div class="sub">${config.relatorio.subtitulo || 'Controle de Pragas'}</div>
                                <div class="empresa-detalhes">
                                    ${config.empresa.cnpj ? 'CNPJ: ' + config.empresa.cnpj : ''}
                                    ${config.empresa.telefone ? ' • ' + config.empresa.telefone : ''}
                                    ${config.empresa.endereco ? ' • ' + config.empresa.endereco : ''}
                                </div>
                            </div>
                        </div>
                        <div class="titulo-relatorio">
                            <h2>${r.titulo}</h2>
                            <div class="data">${modelo ? modelo.nome : 'Modelo não encontrado'} • ${r.data}</div>
                        </div>
                    </div>
                    <div class="info-grid">
                        <div class="item">
                            <div class="label">Cliente</div>
                            <div class="value">${clienteInfo}</div>
                        </div>
                        <div class="item">
                            <div class="label">${cliente && cliente.tipoCliente === 'cnpj' ? 'CNPJ' : 'CPF'}</div>
                            <div class="value">${documentoInfo}</div>
                        </div>
                        <div class="item">
                            <div class="label">Tipo de Cliente</div>
                            <div class="value">${tipoInfo}</div>
                        </div>
                        <div class="item">
                            <div class="label">Telefone</div>
                            <div class="value">${cliente ? cliente.telefone : 'N/A'}</div>
                        </div>
                        <div class="item">
                            <div class="label">Status</div>
                            <div class="value">${getStatusBadge(r.status)}</div>
                        </div>
                        <div class="item">
                            <div class="label">Gravidade</div>
                            <div class="value">${getGravidadeBadge(r.gravidade)}</div>
                        </div>
                    </div>
                    
                    <h4 style="color:#0b2a3b;margin:16px 0 8px;">Campos do Relatório</h4>
                    <div style="background:#f8fbfd;border-radius:8px;padding:8px 16px;">
                        ${camposHtml}
                    </div>
                    
                    ${r.imagens && r.imagens.length > 0 ? `
                        <h4 style="color:#0b2a3b;margin:16px 0 8px;">Imagens Anexadas (${r.imagens.length})</h4>
                        <div class="imagens-container">
                            ${imagensHtml}
                        </div>
                    ` : ''}
                    
                    ${r.observacoes ? `
                        <div class="observacoes">
                            <strong>Observações:</strong>
                            <p style="margin: 4px 0 0;">${r.observacoes}</p>
                        </div>
                    ` : ''}
                    
                    <div class="footer">
                        <p>${config.relatorio.rodape || 'Relatório técnico - Controle de Pragas'}</p>
                    </div>
                    <div style="margin-top:20px;display:flex;gap:12px;justify-content:flex-end;border-top:1px solid #e8eff5;padding-top:20px;">
                        <button class="btn-secondary" onclick="fecharModalRelatorio()">Fechar</button>
                        <button class="btn-primary" onclick="imprimirRelatorio(${r.id})"><i class="fas fa-print"></i> Imprimir</button>
                        <button class="btn-primary" onclick="baixarRelatorio(${r.id})"><i class="fas fa-download"></i> Baixar</button>
                    </div>
                </div>
            `;
        }
        var overlay = document.getElementById('modalRelatorioOverlay');
        if (overlay) overlay.classList.add('active');
    };

    window.atualizarCampoRelatorio = function (id, label, novoValor) {
        var r = DB.getById('relatorios', id);
        if (!r) return;
        var campos = r.campos.map(function (c) {
            if (c.label === label) {
                return Object.assign({}, c, { valor: novoValor });
            }
            return c;
        });
        DB.update('relatorios', id, { campos: campos });
    };

    window.fecharModalRelatorio = function () {
        var overlay = document.getElementById('modalRelatorioOverlay');
        if (overlay) overlay.classList.remove('active');
        window._relatorioVisualizandoId = null;
    };

    var modalRelatorioClose = document.getElementById('modalRelatorioClose');
    if (modalRelatorioClose) modalRelatorioClose.addEventListener('click', fecharModalRelatorio);
    var modalRelatorioOverlay = document.getElementById('modalRelatorioOverlay');
    if (modalRelatorioOverlay) {
        modalRelatorioOverlay.addEventListener('click', function (e) {
            if (e.target === this) fecharModalRelatorio();
        });
    }

    // =============================================
    // ===== IMPRIMIR RELATÓRIO =====
    // =============================================
    window.imprimirRelatorio = function (id) {
        var r = DB.getById('relatorios', id);
        if (!r) return;

        var cliente = getCliente(r.clienteId);
        var modelo = DB.getById('modelos', r.modeloId);
        var config = DB.getConfig();
        var cor = config.relatorio.cor || '#0b2a3b';

        var clienteNome = cliente ? cliente.nome : 'N/A';
        var clienteDocumento = cliente ? cliente.documento || 'N/A' : 'N/A';
        var clienteTipo = cliente ? (cliente.tipoCliente === 'cnpj' ? 'Pessoa Jurídica (CNPJ)' : 'Pessoa Física (CPF)') : 'N/A';

        var camposHtml = r.campos.map(function (campo) {
            return '<tr>' +
                '<td style="font-weight:600;color:#0b2a3b;padding:2px 6px;border-bottom:1px solid #e8eff5;font-size:6.5pt;">' + campo.label + '</td>' +
                '<td style="color:#4d687a;padding:2px 6px;border-bottom:1px solid #e8eff5;font-size:6.5pt;">' + (campo.valor || '(vazio)') + '</td>' +
                '</tr>';
        }).join('');

        var imagensHtml = r.imagens && r.imagens.length > 0 ?
            r.imagens.map(function (img) {
                return '<div style="display:inline-block;width:100px;margin:4px;border:1px solid #e8eff5;border-radius:4px;overflow:hidden;">' +
                    '<img src="' + img + '" style="width:100%;height:80px;object-fit:cover;" />' +
                    '</div>';
            }).join('') : '';

        var logoHtml = config.empresa.logo ?
            '<img src="' + config.empresa.logo + '" style="max-height:40px;max-width:120px;object-fit:contain;" />' : '';

        var conteudo = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8" />
                <title>${r.titulo}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: Arial, sans-serif; 
                        padding: 4px; 
                        max-width: 100%; 
                        margin: 0; 
                        font-size: 8pt; 
                        line-height: 1.2; 
                        color: #1f3542;
                        background: white;
                    }
                    .header { 
                        text-align: center; 
                        border-bottom: 3px solid ${cor}; 
                        padding-bottom: 4px; 
                        margin-bottom: 4px; 
                    }
                    .header .logo-container { 
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        gap: 10px; 
                        flex-wrap: wrap; 
                    }
                    .header h1 { 
                        color: ${cor}; 
                        margin: 0; 
                        font-size: 11pt; 
                    }
                    .header .sub { 
                        color: #4d687a; 
                        font-size: 6.5pt; 
                    }
                    .header .detalhes { 
                        font-size: 5.5pt; 
                        color: #4d687a; 
                        margin-top: 2px; 
                    }
                    .header .titulo { 
                        margin-top: 4px; 
                        padding-top: 4px; 
                        border-top: 1px dashed #e8eff5; 
                    }
                    .header .titulo h2 { 
                        color: ${cor}; 
                        font-size: 10pt; 
                        margin: 0; 
                    }
                    .info { 
                        display: grid; 
                        grid-template-columns: 1fr 1fr 1fr; 
                        gap: 4px; 
                        background: #f5f9fc; 
                        padding: 6px 10px; 
                        border-radius: 4px; 
                        margin-bottom: 4px; 
                        font-size: 6.5pt;
                    }
                    .info .label { 
                        font-size: 5pt; 
                        color: #6a7f8d; 
                        text-transform: uppercase; 
                        font-weight: bold; 
                    }
                    .info .value { 
                        font-weight: 600; 
                        color: #0b2a3b; 
                        font-size: 6.5pt; 
                    }
                    table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin: 3px 0; 
                        font-size: 6.5pt;
                    }
                    th { 
                        background: ${cor}; 
                        color: white; 
                        padding: 2px 6px; 
                        text-align: left; 
                        font-size: 5.5pt;
                    }
                    td { 
                        padding: 2px 6px; 
                        border-bottom: 1px solid #e8eff5; 
                        font-size: 6pt; 
                    }
                    .imagens { 
                        text-align: center; 
                        margin: 4px 0; 
                    }
                    .obs { 
                        margin-top: 4px; 
                        padding: 4px 10px; 
                        background: #f8fbfd; 
                        border-radius: 4px; 
                        border-left: 3px solid ${cor}; 
                        font-size: 6.5pt;
                    }
                    .footer { 
                        margin-top: 6px; 
                        text-align: center; 
                        color: #6a7f8d; 
                        font-size: 5pt; 
                        border-top: 1px solid #e8eff5; 
                        padding-top: 4px; 
                    }
                    .badge { 
                        padding: 1px 8px; 
                        border-radius: 12px; 
                        font-size: 5.5pt; 
                        display: inline-block; 
                        font-weight: 600; 
                    }
                    .badge.success { background: #d1f0e5; color: #006b4f; }
                    .badge.warning { background: #fff2d0; color: #8e6100; }
                    .badge.danger { background: #fde2e0; color: #b13e3a; }
                    .badge.info { background: #d6eaf8; color: #1a5276; }
                    @media print {
                        body { padding: 2px; }
                        .no-print { display: none !important; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo-container">
                        ${logoHtml}
                        <div>
                            <h1>${config.empresa.nome || 'Click Saúde Ambiental'}</h1>
                            <div class="sub">${config.relatorio.subtitulo || 'Controle de Pragas'}</div>
                            <div class="detalhes">
                                ${config.empresa.cnpj ? 'CNPJ: ' + config.empresa.cnpj : ''}
                                ${config.empresa.telefone ? ' • ' + config.empresa.telefone : ''}
                                ${config.empresa.endereco ? ' • ' + config.empresa.endereco : ''}
                            </div>
                        </div>
                    </div>
                    <div class="titulo">
                        <h2>${r.titulo}</h2>
                        <div style="color:#4d687a;font-size:6.5pt;">${modelo ? modelo.nome : 'Modelo não encontrado'} • ${r.data}</div>
                    </div>
                </div>

                <div class="info">
                    <div>
                        <span class="label">Cliente</span>
                        <div class="value">${clienteNome}</div>
                        <div style="font-size:5.5pt;color:#1d7a6b;">${clienteTipo}</div>
                    </div>
                    <div>
                        <span class="label">${cliente && cliente.tipoCliente === 'cnpj' ? 'CNPJ' : 'CPF'}</span>
                        <div class="value">${clienteDocumento}</div>
                    </div>
                    <div>
                        <span class="label">Telefone</span>
                        <div class="value">${cliente ? cliente.telefone : 'N/A'}</div>
                    </div>
                    <div>
                        <span class="label">Status</span>
                        <div class="value"><span class="badge ${r.status === 'Concluído' ? 'success' : r.status === 'Em andamento' ? 'warning' : 'danger'}">${r.status}</span></div>
                    </div>
                    <div>
                        <span class="label">Gravidade</span>
                        <div class="value"><span class="badge ${r.gravidade === 'Baixa' ? 'success' : r.gravidade === 'Média' ? 'warning' : 'danger'}">${r.gravidade}</span></div>
                    </div>
                    <div>
                        <span class="label">Endereço</span>
                        <div class="value">${cliente ? cliente.endereco : 'N/A'}</div>
                    </div>
                </div>

                <h3 style="color:#0b2a3b;font-size:8pt;margin:3px 0;">Campos do Relatório</h3>
                <table>
                    <thead><tr><th style="font-size:5.5pt;">Campo</th><th style="font-size:5.5pt;">Valor</th></tr></thead>
                    <tbody>${camposHtml}</tbody>
                </table>

                ${r.imagens && r.imagens.length > 0 ? `
                    <h3 style="color:#0b2a3b;font-size:8pt;margin:3px 0;">Imagens Anexadas (${r.imagens.length})</h3>
                    <div class="imagens">
                        ${r.imagens.map(img => `
                            <div style="display:inline-block;width:80px;margin:3px;border:1px solid #e8eff5;border-radius:4px;overflow:hidden;">
                                <img src="${img}" style="width:100%;height:60px;object-fit:cover;" />
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                ${r.observacoes ? `
                    <div class="obs">
                        <strong style="font-size:6.5pt;">Observações:</strong>
                        <p style="margin: 2px 0 0;font-size:6pt;">${r.observacoes}</p>
                    </div>
                ` : ''}

                <div class="footer">
                    <p>${config.relatorio.rodape || 'Relatório técnico - Controle de Pragas'}</p>
                    <p>${config.empresa.nome || 'Click Saúde Ambiental'} - ${config.empresa.cnpj ? 'CNPJ: ' + config.empresa.cnpj : ''}</p>
                </div>

                <script>
                    window.onload = function() { window.print(); }
                <\/script>
            </body>
            </html>
        `;

        var win = window.open('', '_blank', 'width=700,height=500');
        if (win) {
            win.document.write(conteudo);
            win.document.close();
        }
    };

    window.baixarRelatorio = function (id) {
        var r = DB.getById('relatorios', id);
        if (!r) return;

        var cliente = getCliente(r.clienteId);
        var modelo = DB.getById('modelos', r.modeloId);
        var config = DB.getConfig();

        var conteudo = '============================================\n';
        conteudo += (config.empresa.nome || 'Click Saúde Ambiental') + '\n';
        conteudo += (config.relatorio.subtitulo || 'Controle de Pragas') + '\n';
        conteudo += (config.empresa.cnpj ? 'CNPJ: ' + config.empresa.cnpj : '') + '\n';
        conteudo += (config.empresa.telefone ? 'Fone: ' + config.empresa.telefone : '') + '\n';
        conteudo += (config.empresa.endereco ? 'End: ' + config.empresa.endereco : '') + '\n';
        conteudo += '============================================\n\n';
        conteudo += r.titulo + '\n';
        conteudo += (modelo ? modelo.nome : 'Modelo não encontrado') + ' • ' + r.data + '\n';
        conteudo += '--------------------------------------------\n\n';
        conteudo += 'Cliente: ' + (cliente ? cliente.nome : 'N/A') + '\n';
        conteudo += 'Tipo: ' + (cliente ? (cliente.tipoCliente === 'cnpj' ? 'Pessoa Jurídica (CNPJ)' : 'Pessoa Física (CPF)') : 'N/A') + '\n';
        conteudo += 'Documento: ' + (cliente ? cliente.documento || 'N/A' : 'N/A') + '\n';
        conteudo += 'Telefone: ' + (cliente ? cliente.telefone : 'N/A') + '\n';
        conteudo += 'Endereço: ' + (cliente ? cliente.endereco : 'N/A') + '\n';
        conteudo += 'Status: ' + r.status + '\n';
        conteudo += 'Gravidade: ' + r.gravidade + '\n\n';
        conteudo += '--- Campos do Relatório ---\n';
        r.campos.forEach(function (c) {
            conteudo += c.label + ': ' + (c.valor || '(vazio)') + '\n';
        });
        if (r.observacoes) {
            conteudo += '\nObservações:\n' + r.observacoes + '\n';
        }
        if (r.imagens && r.imagens.length > 0) {
            conteudo += '\nImagens: ' + r.imagens.length + ' imagem(ns) anexada(s)\n';
        }
        conteudo += '\n============================================\n';
        conteudo += (config.relatorio.rodape || 'Relatório técnico - Controle de Pragas') + '\n';
        conteudo += '============================================\n';

        var blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = r.titulo.replace(/\s/g, '_') + '.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('Relatório baixado com sucesso!');
    };

    // =============================================
    // ===== FUNÇÕES DE ORDEM DE SERVIÇO (continuação) =====
    // =============================================
    window.excluirOS = function (id) {
        if (confirm('Tem certeza que deseja excluir esta Ordem de Serviço?')) {
            var os = DB.getById('ordens', id);
            if (!os) return;

            var numeroOS = os.numero || 'OS-' + String(id).padStart(3, '0');

            if (os && os.inseticidasUtilizados) {
                os.inseticidasUtilizados.forEach(function (ins) {
                    if (ins.id && ins.quantidade > 0) {
                        var produto = DB.getById('estoque', ins.id);
                        if (produto) {
                            var novaQuantidade = produto.quantidade + ins.quantidade;
                            DB.update('estoque', ins.id, {
                                quantidade: novaQuantidade,
                                ultimaMovimentacao: new Date().toLocaleDateString('pt-BR')
                            });

                            DB.add('movimentacoes', {
                                produtoId: ins.id,
                                tipo: 'entrada',
                                quantidade: ins.quantidade,
                                data: new Date().toLocaleString('pt-BR'),
                                motivo: 'Restauração - Exclusão OS ' + numeroOS,
                                observacao: 'Estoque restaurado após exclusão da OS ' + numeroOS,
                                usuario: 'Admin',
                                estoqueAnterior: produto.quantidade,
                                estoqueAtual: novaQuantidade
                            });
                        }
                    }
                });
            }

            DB.remove('ordens', id);
            DB._clearAllCaches();
            renderAll();
            alert('OS ' + numeroOS + ' excluída com sucesso! Estoque restaurado.');
        }
    };

    window.editarOS = function (id) {
        var os = DB.getById('ordens', id);
        if (!os) return;

        var clientes = DB.getAll('clientes');
        var produtos = DB.getAll('estoque');

        var inseticidas = produtos.filter(function (p) { return p.quantidade > 0; });

        var servicosHtml = gerarCheckboxes(SERVICOS_LIST, os.servicosExecutados || [], 'servico-check', false);
        var pragasHtml = gerarCheckboxes(PRAGAS_LIST, os.pragasAlvo || [], 'praga-check', false);
        var metodosHtml = gerarCheckboxes(METODOS_LIST, os.metodosEmpregados || [], 'metodo-check', false);

        var inseticidasHtml = (os.inseticidasUtilizados || []).map(function (ins, idx) {
            return '<div class="form-row inseticida-row" data-index="' + idx + '">' +
                '<div class="form-group" style="flex:2;">' +
                '<label>Produto</label>' +
                '<select class="ins-produto">' +
                '<option value="">Selecione...</option>' +
                inseticidas.map(function (p) {
                    return '<option value="' + p.id + '" ' + (p.id === ins.id ? 'selected' : '') + '>' +
                        p.nome + ' (' + p.categoria + ' - ' + p.quantidade + ' ' + p.unidade + ')' +
                        '</option>';
                }).join('') +
                '</select>' +
                '</div>' +
                '<div class="form-group" style="flex:0.8;">' +
                '<label>Reg. MS</label>' +
                '<input type="text" class="ins-registro" value="' + (ins.registro || '') + '" />' +
                '</div>' +
                '<div class="form-group" style="flex:0.8;">' +
                '<label>G. Químico</label>' +
                '<input type="text" class="ins-quimico" value="' + (ins.gQuimico || '') + '" />' +
                '</div>' +
                '<div class="form-group" style="flex:0.8;">' +
                '<label>P. Ativo</label>' +
                '<input type="text" class="ins-ativo" value="' + (ins.pAtivo || '') + '" />' +
                '</div>' +
                '<div class="form-group" style="flex:0.6;">' +
                '<label>%</label>' +
                '<input type="text" class="ins-porcentagem" value="' + (ins.porcentagem || '') + '" />' +
                '</div>' +
                '<div class="form-group" style="flex:0.8;">' +
                '<label>Quantidade</label>' +
                '<input type="number" class="ins-quantidade" value="' + (ins.quantidade || 1) + '" min="0" step="0.1" />' +
                '</div>' +
                '<div class="form-group" style="flex:1;">' +
                '<label>Tratamento</label>' +
                '<input type="text" class="ins-tratamento" value="' + (ins.tratamento || 'Aplicação') + '" />' +
                '</div>' +
                '<div style="display:flex;align-items:flex-end;padding-bottom:6px;">' +
                '<button class="btn-danger btn-sm" onclick="removerInseticida(this)"><i class="fas fa-times"></i></button>' +
                '</div>' +
                '</div>';
        }).join('') || '';

        var garantia = os.garantia || '';

        abrirModal('Editar OS ' + os.numero, `
            <div class="form-group">
                <label>Cliente</label>
                <select id="modalOSCliente">
                    ${clientes.map(c => `<option value="${c.id}" ${c.id === os.clienteId ? 'selected' : ''}>${c.nome} (${c.tipoCliente === 'cnpj' ? 'CNPJ' : 'CPF'})</option>`).join('')}
                </select>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Data</label><input type="date" id="modalOSData" value="${os.data.split('/').reverse().join('-')}" /></div>
                <div class="form-group"><label>Data de Entrega</label><input type="date" id="modalOSEntrega" value="${os.dataEntrega ? os.dataEntrega.split('/').reverse().join('-') : ''}" /></div>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="modalOSStatus">
                    ${['Pendente', 'Em andamento', 'Concluída', 'Cancelada'].map(s => `<option value="${s}" ${s === os.status ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </div>
            
            <h4 style="margin:12px 0 8px;color:#0b2a3b;">Serviços Executados</h4>
            <div class="checkbox-grid">
                ${servicosHtml}
            </div>
            
            <h4 style="margin:12px 0 8px;color:#0b2a3b;">Pragas Alvo</h4>
            <div class="checkbox-grid">
                ${pragasHtml}
            </div>
            
            <h4 style="margin:12px 0 8px;color:#0b2a3b;">Métodos Empregados</h4>
            <div class="checkbox-grid">
                ${metodosHtml}
            </div>
            
            <h4 style="margin:16px 0 8px;color:#0b2a3b;">Inseticidas Utilizados</h4>
            <div id="inseticidasContainer">
                ${inseticidasHtml}
            </div>
            <button class="btn-secondary btn-sm" onclick="adicionarInseticida()" style="margin-top:4px;">
                <i class="fas fa-plus"></i> Adicionar Inseticida
            </button>
            
            <div class="form-group" style="margin-top:12px;">
                <label>Área Liberada</label>
                <textarea id="modalOSAreaLiberada" rows="2" placeholder="Informe a área liberada para acesso...">${os.areaLiberada || ''}</textarea>
            </div>
            
            <div class="form-group" style="margin-top:12px;">
                <label>Observações</label>
                <textarea id="modalOSObs" rows="2">${os.observacoes || ''}</textarea>
            </div>

            <div class="form-group" style="margin-top:12px;">
                <label>📝 Texto da Garantia do Serviço</label>
                <textarea id="modalOSGarantia" rows="4" placeholder="Digite o texto da garantia do serviço..." style="width:100%;padding:10px 14px;border:1px solid #dce4ec;border-radius:10px;font-size:0.9rem;outline:none;transition:0.2s;resize:vertical;font-family:inherit;background:#fafcfe;">${garantia}</textarea>
                <small style="color:#4d687a;font-size:0.75rem;display:block;margin-top:4px;">Este texto aparecerá no rodapé da Ordem de Serviço impressa.</small>
            </div>
            
            <div class="modal-footer">
                <button class="btn-secondary" onclick="fecharModal()">Cancelar</button>
                <button class="btn-primary" onclick="salvarEdicaoOS(${id})">Salvar</button>
            </div>
        `);
    };

    window.salvarEdicaoOS = function (id) {
        var clienteId = parseInt(document.getElementById('modalOSCliente')?.value || '0');
        var data = document.getElementById('modalOSData')?.value?.split('-').reverse().join('/') || '';
        var dataEntrega = document.getElementById('modalOSEntrega')?.value ?
            document.getElementById('modalOSEntrega').value.split('-').reverse().join('/') : '';
        var status = document.getElementById('modalOSStatus')?.value || 'Pendente';
        var observacoes = document.getElementById('modalOSObs')?.value || '';
        var areaLiberada = document.getElementById('modalOSAreaLiberada')?.value || '';
        var garantia = document.getElementById('modalOSGarantia')?.value || '';

        var servicosExecutados = [];
        document.querySelectorAll('.servico-check:checked').forEach(function (el) {
            servicosExecutados.push(el.value);
        });

        var pragasAlvo = [];
        document.querySelectorAll('.praga-check:checked').forEach(function (el) {
            pragasAlvo.push(el.value);
        });

        var metodosEmpregados = [];
        document.querySelectorAll('.metodo-check:checked').forEach(function (el) {
            metodosEmpregados.push(el.value);
        });

        var inseticidasUtilizados = [];
        document.querySelectorAll('.inseticida-row').forEach(function (row) {
            var select = row.querySelector('.ins-produto');
            var produtoId = select ? parseInt(select.value) : null;
            if (produtoId) {
                var produto = DB.getById('estoque', produtoId);
                inseticidasUtilizados.push({
                    id: produtoId,
                    nome: produto ? produto.nome : '',
                    unidade: produto ? produto.unidade : '',
                    registro: row.querySelector('.ins-registro')?.value || '',
                    gQuimico: row.querySelector('.ins-quimico')?.value || '',
                    pAtivo: row.querySelector('.ins-ativo')?.value || '',
                    porcentagem: row.querySelector('.ins-porcentagem')?.value || '',
                    quantidade: parseFloat(row.querySelector('.ins-quantidade')?.value) || 0,
                    tratamento: row.querySelector('.ins-tratamento')?.value || 'Aplicação'
                });
            }
        });

        if (inseticidasUtilizados.length === 0) {
            alert('Adicione pelo menos um inseticida à OS.');
            return;
        }

        var osAtual = DB.getById('ordens', id);
        var numeroOS = osAtual?.numero || 'OS-' + String(id).padStart(3, '0');
        var inseticidasAnteriores = osAtual?.inseticidasUtilizados || [];

        inseticidasAnteriores.forEach(function (ins) {
            if (ins.id && ins.quantidade > 0) {
                var produto = DB.getById('estoque', ins.id);
                if (produto) {
                    var novaQuantidade = produto.quantidade + ins.quantidade;
                    DB.update('estoque', ins.id, {
                        quantidade: novaQuantidade,
                        ultimaMovimentacao: new Date().toLocaleDateString('pt-BR')
                    });

                    DB.add('movimentacoes', {
                        produtoId: ins.id,
                        tipo: 'entrada',
                        quantidade: ins.quantidade,
                        data: new Date().toLocaleString('pt-BR'),
                        motivo: 'Restauração - Edição OS ' + numeroOS,
                        observacao: 'Estoque restaurado durante edição da OS ' + numeroOS,
                        usuario: 'Admin',
                        estoqueAnterior: produto.quantidade,
                        estoqueAtual: novaQuantidade
                    });
                }
            }
        });

        var movimentacoesRegistradas = [];
        inseticidasUtilizados.forEach(function (ins) {
            if (ins.id && ins.quantidade > 0) {
                var produto = DB.getById('estoque', ins.id);
                if (produto) {
                    var novaQuantidade = Math.max(0, produto.quantidade - ins.quantidade);
                    DB.update('estoque', ins.id, {
                        quantidade: novaQuantidade,
                        ultimaMovimentacao: new Date().toLocaleDateString('pt-BR')
                    });

                    var mov = {
                        produtoId: ins.id,
                        tipo: 'saida',
                        quantidade: ins.quantidade,
                        data: new Date().toLocaleString('pt-BR'),
                        motivo: 'OS ' + numeroOS,
                        observacao: 'Uso em Ordem de Serviço ' + numeroOS + ' - Cliente: ' + getClienteNome(clienteId),
                        usuario: 'Admin',
                        estoqueAnterior: produto.quantidade,
                        estoqueAtual: novaQuantidade
                    };
                    DB.add('movimentacoes', mov);
                    movimentacoesRegistradas.push(mov);
                }
            }
        });

        var itens = inseticidasUtilizados.map(function (ins) {
            return {
                descricao: ins.nome,
                quantidade: ins.quantidade,
                valorUnitario: 0,
                inseticidaId: ins.id
            };
        });

        var valorTotal = inseticidasUtilizados.reduce(function (sum, ins) { return sum + (ins.quantidade * 0); }, 0);

        DB.update('ordens', id, {
            clienteId: clienteId, data: data, dataEntrega: dataEntrega, status: status, observacoes: observacoes,
            areaLiberada: areaLiberada, garantia: garantia,
            servicosExecutados: servicosExecutados, pragasAlvo: pragasAlvo, metodosEmpregados: metodosEmpregados, inseticidasUtilizados: inseticidasUtilizados,
            itens: itens,
            movimentacoes: movimentacoesRegistradas,
            valorTotal: valorTotal,
            atualizadoEm: new Date().toISOString()
        });

        DB._clearAllCaches();
        fecharModal();
        renderAll();
        alert('OS ' + numeroOS + ' atualizada com sucesso! Estoque atualizado (' + movimentacoesRegistradas.length + ' produto(s) baixado(s)).');
    };

    // =============================================
    // ===== IMPRIMIR OS =====
    // =============================================
    window.imprimirOS = function (id) {
        var os = DB.getById('ordens', id);
        if (!os) return;

        var cliente = getCliente(os.clienteId);
        var config = DB.getConfig();

        var servicosExecutados = os.servicosExecutados || [];
        var pragasAlvo = os.pragasAlvo || [];
        var metodosEmpregados = os.metodosEmpregados || [];
        var inseticidasUtilizados = os.inseticidasUtilizados || [];
        var areaLiberada = os.areaLiberada || '';
        var assinaturaOperador = os.assinaturaOperador || '';
        var assinaturaCliente = os.assinaturaCliente || '';

        var garantiaTexto = os.garantia || config.relatorio.garantia || 'Garantia do serviço: 90 dias a partir da data do primeiro serviço\nOBS: Reentrada no local só será permitida após 06 horas da aplicação líquida, mediante o ambiente arejado, e todo objeto encontrado no chão que não puder ser descartado deverá ser higienizado antes do uso.';
        var garantiaLinhas = garantiaTexto.split('\n');

        var inseticidasHtml = '';
        if (inseticidasUtilizados.length > 0) {
            inseticidasUtilizados.forEach(function (ins) {
                inseticidasHtml += '<tr>' +
                    '<td style="padding:4px 6px;border:1px solid #ccc;text-align:center;font-size:9pt;">' + ins.nome + '</td>' +
                    '<td style="padding:4px 6px;border:1px solid #ccc;text-align:center;font-size:9pt;">' + (ins.registro || 'N/A') + '</td>' +
                    '<td style="padding:4px 6px;border:1px solid #ccc;text-align:center;font-size:9pt;">' + (ins.gQuimico || '-') + '</td>' +
                    '<td style="padding:4px 6px;border:1px solid #ccc;text-align:center;font-size:9pt;">' + (ins.pAtivo || '-') + '</td>' +
                    '<td style="padding:4px 6px;border:1px solid #ccc;text-align:center;font-size:9pt;">' + (ins.porcentagem || '-') + '</td>' +
                    '<td style="padding:4px 6px;border:1px solid #ccc;text-align:center;font-size:9pt;">' + ins.quantidade + ' ' + (ins.unidade || '') + '</td>' +
                    '<td style="padding:4px 6px;border:1px solid #ccc;text-align:center;font-size:9pt;">' + (ins.tratamento || 'Aplicação') + '</td>' +
                    '</tr>';
            });
        } else {
            inseticidasHtml = '<tr>' +
                '<td colspan="7" style="padding:4px;text-align:center;color:#999;font-size:9pt;">Nenhum inseticida registrado</td>' +
                '</tr>';
        }

        function gerarCheckboxImpressao(lista, selecionados, cols) {
            cols = cols || 4;
            var html = '<div style="display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:2px 8px;font-size:9pt;">';
            lista.forEach(function (item) {
                var checked = selecionados.indexOf(item) !== -1 ? 'checked' : '';
                html += '<div style="display:flex;align-items:center;gap:4px;padding:2px 0;">' +
                    '<input type="checkbox" ' + checked + ' style="width:12px;height:12px;margin:0;flex-shrink:0;" />' +
                    '<span style="font-size:9pt;">' + item + '</span>' +
                    '</div>';
            });
            html += '</div>';
            return html;
        }

        var dataAtendimento = os.data || new Date().toLocaleDateString('pt-BR');
        var numeroChamado = os.numero || 'N/A';

        var conteudo = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8" />
            <title>OS ${os.numero}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: Arial, sans-serif; 
                    padding: 8px; 
                    max-width: 100%; 
                    margin: 0; 
                    font-size: 10pt; 
                    line-height: 1.4;
                    color: #1f3542;
                    background: white;
                }
                .header-empresa { 
                    text-align: center; 
                    border-bottom: 2px solid #0b2a3b; 
                    padding-bottom: 8px; 
                    margin-bottom: 8px; 
                }
                .header-empresa h1 { 
                    font-size: 16pt; 
                    color: #0b2a3b; 
                    margin: 0; 
                    letter-spacing: 1px;
                }
                .header-empresa p { 
                    margin: 2px 0; 
                    color: #4d687a; 
                    font-size: 9pt; 
                }
                .titulo-os { 
                    text-align: center; 
                    font-size: 14pt; 
                    font-weight: bold; 
                    margin: 4px 0; 
                    color: #0b2a3b; 
                    letter-spacing: 2px;
                }
                .info-cliente { 
                    border: 1px solid #ccc; 
                    padding: 6px 12px; 
                    margin: 6px 0; 
                    border-radius: 4px; 
                    background: #f9f9f9;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 2px 16px;
                }
                .info-cliente .row { 
                    display: flex; 
                    margin: 2px 0; 
                    font-size: 9pt; 
                }
                .info-cliente .label { 
                    font-weight: bold; 
                    width: 80px; 
                    flex-shrink: 0; 
                    color: #0b2a3b; 
                }
                .info-cliente .value { 
                    flex: 1; 
                    color: #1f3542; 
                }
                .header-info { 
                    display: flex; 
                    justify-content: space-between; 
                    margin: 4px 0; 
                    font-size: 9pt;
                    padding: 4px 10px;
                    background: #f5f9fc;
                    border-radius: 4px;
                    border: 1px solid #e8eff5;
                }
                .section-title { 
                    font-weight: bold; 
                    font-size: 10pt; 
                    margin: 6px 0 4px 0;
                    padding: 4px 10px;
                    background: #eef4f8;
                    border-radius: 4px;
                    color: #0b2a3b;
                }
                .servicos-grid { margin: 2px 0 4px 0; }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin: 4px 0; 
                    font-size: 9pt; 
                }
                th { 
                    background: #0b2a3b; 
                    color: white; 
                    padding: 4px 6px; 
                    text-align: center; 
                    border: 1px solid #0b2a3b; 
                    font-size: 8pt;
                }
                td { 
                    padding: 3px 6px; 
                    border: 1px solid #ccc; 
                    text-align: center; 
                    font-size: 8.5pt;
                }
                .garantia { 
                    background: #f0f7fc; 
                    padding: 6px 12px; 
                    border-radius: 4px; 
                    margin: 6px 0; 
                    font-size: 8.5pt;
                    border-left: 4px solid #0b2a3b;
                    white-space: pre-line;
                    line-height: 1.5;
                }
                .garantia strong { 
                    font-size: 8.5pt; 
                    color: #0b2a3b; 
                }
                .area-comentarios { margin: 4px 0; }
                .area-comentarios .area-box,
                .area-comentarios .coment-box { 
                    border: 1px solid #999; 
                    min-height: 24px;
                    padding: 4px 8px; 
                    font-size: 8.5pt;
                    border-radius: 3px;
                    overflow-y: auto;
                    word-wrap: break-word;
                    white-space: pre-wrap;
                    background: white;
                    margin: 2px 0;
                }
                .assinatura-digital {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                    margin: 6px 0;
                    padding: 6px 12px;
                    background: #f5f9fc;
                    border-radius: 4px;
                    border: 1px solid #e8eff5;
                }
                .assinatura-digital .sig-item { text-align: center; }
                .assinatura-digital .sig-item img {
                    max-width: 120px;
                    max-height: 40px;
                    border: 1px solid #ddd;
                    border-radius: 3px;
                    background: white;
                }
                .assinatura-digital .sig-item .sig-label {
                    font-size: 8pt;
                    font-weight: bold;
                    color: #0b2a3b;
                    margin-bottom: 3px;
                }
                .linha-assinatura { 
                    display: flex; 
                    justify-content: space-around; 
                    margin-top: 8px; 
                    padding-top: 8px; 
                    border-top: 2px solid #ccc; 
                }
                .campo-assinatura { 
                    text-align: center; 
                    flex: 1; 
                    padding: 0 12px;
                }
                .campo-assinatura .linha { 
                    border-bottom: 2px solid #000; 
                    width: 80%; 
                    margin: 0 auto; 
                    height: 30px;
                    min-height: 30px;
                }
                .campo-assinatura .legenda { 
                    font-size: 8pt; 
                    color: #4d687a; 
                    margin-top: 4px;
                    font-weight: bold;
                }
                .footer { 
                    margin-top: 6px; 
                    text-align: center; 
                    color: #6a7f8d; 
                    font-size: 7pt; 
                    border-top: 1px solid #e8eff5; 
                    padding-top: 4px; 
                }
                .no-print { display: none; }
                @media print {
                    body { padding: 4px; }
                    .no-print { display: none !important; }
                    .campo-assinatura .linha { height: 30px; min-height: 30px; }
                }
            </style>
        </head>
        <body>
            <div class="header-empresa">
                <h1>${config.empresa.nome || 'CLICK SAÚDE AMBIENTAL'}</h1>
                <p>${config.empresa.endereco || 'Rua D. Rosa da Fonseca, 154, Prado -- CEP 57010-130 - Maceió -- AL'}</p>
                <p>${config.empresa.telefone ? 'Tel: ' + config.empresa.telefone : 'Tel: (82) 21408745 -- 996734573 -- 998351439'}</p>
                ${config.empresa.cnpj ? '<p>CNPJ: ' + config.empresa.cnpj + '</p>' : ''}
            </div>

            <div class="titulo-os">ORDEM DE SERVIÇO</div>

            <div class="header-info">
                <span><strong>Data:</strong> ${dataAtendimento}</span>
                <span><strong>N°:</strong> ${numeroChamado}</span>
                <span><strong>Status:</strong> ${os.status || 'Pendente'}</span>
            </div>

            <div class="info-cliente">
                <div class="row">
                    <span class="label">Razão social:</span>
                    <span class="value">${cliente ? cliente.nome : 'N/A'}</span>
                </div>
                <div class="row">
                    <span class="label">${cliente && cliente.tipoCliente === 'cnpj' ? 'CNPJ' : 'CPF'}:</span>
                    <span class="value">${cliente ? cliente.documento || 'N/A' : 'N/A'}</span>
                </div>
                <div class="row">
                    <span class="label">Endereço:</span>
                    <span class="value">${cliente ? cliente.endereco : 'N/A'}</span>
                </div>
                <div class="row">
                    <span class="label">Contato:</span>
                    <span class="value">${cliente ? 'Sr(a). ' + cliente.nome + ' - Cel: ' + (cliente.telefone || 'N/A') : 'N/A'}</span>
                </div>
            </div>

            <div class="section-title">SERVIÇOS EXECUTADOS</div>
            <div class="servicos-grid">${gerarCheckboxImpressao(SERVICOS_LIST, servicosExecutados, 4)}</div>

            <div class="section-title">PRAGAS ALVO</div>
            <div class="servicos-grid">${gerarCheckboxImpressao(PRAGAS_LIST, pragasAlvo, 4)}</div>

            <div class="section-title">MÉTODO EMPREGADO</div>
            <div class="servicos-grid">${gerarCheckboxImpressao(METODOS_LIST, metodosEmpregados, 3)}</div>

            <div class="section-title">INSETICIDAS UTILIZADOS</div>
            <table>
                <thead>
                    <tr>
                        <th style="width:14%;">Produto</th>
                        <th style="width:10%;">Reg. MS</th>
                        <th style="width:10%;">G. Químico</th>
                        <th style="width:12%;">P. Ativo</th>
                        <th style="width:7%;">%</th>
                        <th style="width:10%;">Qtd.</th>
                        <th style="width:14%;">Tratamento</th>
                    </tr>
                </thead>
                <tbody>${inseticidasHtml}</tbody>
            </table>

            <div class="area-comentarios">
                <div style="margin:2px 0;">
                    <div style="font-weight:bold;font-size:8.5pt;color:#0b2a3b;">ÁREA LIBERADA:</div>
                    <div class="area-box">${areaLiberada || ''}</div>
                </div>
                <div style="margin:2px 0;">
                    <div style="font-weight:bold;font-size:8.5pt;color:#0b2a3b;">OBSERVAÇÕES:</div>
                    <div class="coment-box">${os.observacoes || ''}</div>
                </div>
            </div>

            <div class="assinatura-digital">
                <div class="sig-item">
                    <div class="sig-label">ASSINATURA DO OPERADOR</div>
                    ${assinaturaOperador ?
                '<img src="' + assinaturaOperador + '" alt="Assinatura Operador" />' :
                '<span style="font-size:8pt;color:#999;">Não assinado</span>'
            }
                </div>
                <div class="sig-item">
                    <div class="sig-label">ASSINATURA DO CLIENTE</div>
                    ${assinaturaCliente ?
                '<img src="' + assinaturaCliente + '" alt="Assinatura Cliente" />' :
                '<span style="font-size:8pt;color:#999;">Não assinado</span>'
            }
                </div>
            </div>

            <div class="linha-assinatura no-print">
                <div class="campo-assinatura">
                    <div class="linha"></div>
                    <div class="legenda">ASSINATURA DO OPERADOR</div>
                </div>
                <div class="campo-assinatura">
                    <div class="linha"></div>
                    <div class="legenda">ASSINATURA DO CLIENTE</div>
                </div>
            </div>

            <div class="garantia">
                <strong>Garantia do serviço:</strong><br>
                ${garantiaLinhas.map(function (line) { return line.trim(); }).join('<br>')}
            </div>

            <div class="footer">
                ${config.empresa.nome || ''} - ${config.empresa.cnpj || ''}
            </div>

            <script>
                window.onload = function() { window.print(); }
            <\/script>
        </body>
        </html>
    `;

        var win = window.open('', '_blank', 'width=900,height=700');
        if (win) {
            win.document.write(conteudo);
            win.document.close();
        }
    };

    // =============================================
    // ===== EXCLUIR MEMBRO =====
    // =============================================
    window.excluirMembro = function (id) {
        if (confirm('Remover este membro da equipe?')) {
            DB.remove('equipe', id);
            DB.forceClearCache('equipe');
            renderAll();
        }
    };

    // =============================================
    // ===== CRIAR NOVO MEMBRO =====
    // =============================================
    window.criarNovoMembro = function () {
        var nome = document.getElementById('modalNomeMembro')?.value || '';
        var cargo = document.getElementById('modalCargoMembro')?.value || 'Técnico';
        if (!nome) {
            alert('Nome é obrigatório');
            return;
        }

        DB.add('equipe', { nome: nome, cargo: cargo });
        DB.forceClearCache('equipe');
        fecharModal();

        renderAll();

        setTimeout(function () {
            renderAll();
        }, 50);

        alert('Membro adicionado!');
    };

    // =============================================
    // ===== FUNÇÕES DE ESTOQUE (continuação) =====
    // =============================================

    function atualizarDashboardEstoque() {
        var produtos = DB.getAll('estoque');
        var movimentacoes = DB.getAll('movimentacoes');

        var elTotalProdutos = document.getElementById('totalProdutos');
        var elTotalItens = document.getElementById('totalItensEstoque');
        var elEstoqueBaixo = document.getElementById('estoqueBaixo');
        var elTotalMov = document.getElementById('totalMovimentacoes');

        if (elTotalProdutos) elTotalProdutos.textContent = produtos.length;
        if (elTotalItens) elTotalItens.textContent = produtos.reduce(function (sum, p) { return sum + p.quantidade; }, 0);
        if (elEstoqueBaixo) elEstoqueBaixo.textContent = produtos.filter(function (p) { return p.quantidade <= p.minimo; }).length;
        if (elTotalMov) elTotalMov.textContent = movimentacoes.length;
    }

    function renderMovimentacoes(filtro, busca) {
        filtro = filtro || 'todos';
        busca = busca || '';
        var movimentacoes = DB.getAll('movimentacoes');
        var produtos = DB.getAll('estoque');

        var movFiltradas = movimentacoes;
        if (filtro !== 'todos') {
            movFiltradas = movFiltradas.filter(function (m) { return m.tipo === filtro; });
        }
        if (busca) {
            movFiltradas = movFiltradas.filter(function (m) {
                var produto = produtos.find(function (p) { return p.id === m.produtoId; });
                return produto && produto.nome.toLowerCase().indexOf(busca.toLowerCase()) !== -1;
            });
        }

        movFiltradas.sort(function (a, b) { return new Date(b.data) - new Date(a.data); });

        var tbody = document.getElementById('tabelaMovimentacoes');
        if (!tbody) return;

        if (movFiltradas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;padding:30px;">Nenhuma movimentação encontrada</td></tr>';
            return;
        }

        tbody.innerHTML = movFiltradas.map(function (m) {
            var produto = produtos.find(function (p) { return p.id === m.produtoId; });
            var tipoClass = m.tipo === 'entrada' ? 'entrada' : 'saida';
            var tipoIcon = m.tipo === 'entrada' ? '⬇️' : '⬆️';

            return '<tr>' +
                '<td>' + m.data + '</td>' +
                '<td>' + (produto ? produto.nome : 'Produto removido') + '</td>' +
                '<td><span class="tipo ' + tipoClass + '">' + tipoIcon + ' ' + (m.tipo === 'entrada' ? 'Entrada' : 'Saída') + '</span></td>' +
                '<td class="quantidade ' + tipoClass + '">' + m.quantidade + ' ' + (produto ? produto.unidade : '') + '</td>' +
                '<td><strong>' + (m.motivo || '-') + '</strong></td>' +
                '<td>' + (m.observacao || '-') + '</td>' +
                '<td>' + (m.usuario || 'Admin') + '</td>' +
                '</tr>';
        }).join('');
    }

    function renderHistorico(dataInicio, dataFim) {
        dataInicio = dataInicio || null;
        dataFim = dataFim || null;
        var movimentacoes = DB.getAll('movimentacoes');
        var produtos = DB.getAll('estoque');

        var historico = movimentacoes.slice();

        if (dataInicio) {
            var inicio = new Date(dataInicio);
            historico = historico.filter(function (m) { return new Date(m.data) >= inicio; });
        }
        if (dataFim) {
            var fim = new Date(dataFim);
            fim.setHours(23, 59, 59);
            historico = historico.filter(function (m) { return new Date(m.data) <= fim; });
        }

        historico.sort(function (a, b) { return new Date(b.data) - new Date(a.data); });

        var tbody = document.getElementById('tabelaHistorico');
        if (!tbody) return;

        if (historico.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;padding:30px;">Nenhum registro encontrado</td></tr>';
            return;
        }

        tbody.innerHTML = historico.map(function (m) {
            var produto = produtos.find(function (p) { return p.id === m.produtoId; });
            var tipoClass = m.tipo === 'entrada' ? 'entrada' : 'saida';

            return '<tr>' +
                '<td>' + m.data + '</td>' +
                '<td>' + (produto ? produto.nome : 'Produto removido') + '</td>' +
                '<td><span class="tipo ' + tipoClass + '">' + (m.tipo === 'entrada' ? 'Entrada' : 'Saída') + '</span></td>' +
                '<td>' + m.quantidade + '</td>' +
                '<td><strong>' + (m.motivo || '-') + '</strong></td>' +
                '<td>' + (m.estoqueAnterior || '-') + '</td>' +
                '<td>' + (m.estoqueAtual || '-') + '</td>' +
                '</tr>';
        }).join('');
    }

    function atualizarGraficosEstoque() {
        var produtos = DB.getAll('estoque');

        var categorias = {};
        produtos.forEach(function (p) {
            categorias[p.categoria] = (categorias[p.categoria] || 0) + p.quantidade;
        });

        var catHtml = Object.entries(categorias).map(function (entry) {
            var cat = entry[0];
            var qtd = entry[1];
            return '<div class="chart-stat">' +
                '<span class="label">' + cat + '</span>' +
                '<span class="value">' + qtd + '</span>' +
                '</div>';
        }).join('') || '<p style="color:#999;">Nenhum produto cadastrado</p>';

        var elGrafico = document.getElementById('graficoCategorias');
        if (elGrafico) elGrafico.innerHTML = catHtml;

        var baixo = produtos.filter(function (p) { return p.quantidade <= p.minimo; });
        var baixoHtml = baixo.length > 0 ?
            baixo.map(function (p) {
                return '<div class="produto-baixo">' +
                    '<span class="nome">' + p.nome + '</span>' +
                    '<span class="quantidade">' + p.quantidade + ' / ' + p.minimo + ' ' + p.unidade + '</span>' +
                    '</div>';
            }).join('') :
            '<p style="color:#1d7a6b;text-align:center;">✅ Todos os produtos estão com estoque adequado</p>';

        var elListaBaixo = document.getElementById('listaEstoqueBaixo');
        if (elListaBaixo) elListaBaixo.innerHTML = baixoHtml;
    }

    // =============================================
    // ===== FUNÇÕES DE FILTROS =====
    // =============================================
    var filtroMovimentacao = document.getElementById('filtroMovimentacao');
    if (filtroMovimentacao) {
        filtroMovimentacao.addEventListener('change', function () {
            var filtro = this.value;
            var busca = document.getElementById('filtroProdutoMov')?.value || '';
            renderMovimentacoes(filtro, busca);
        });
    }

    var filtroProdutoMov = document.getElementById('filtroProdutoMov');
    if (filtroProdutoMov) {
        filtroProdutoMov.addEventListener('input', function () {
            var filtro = document.getElementById('filtroMovimentacao')?.value || 'todos';
            renderMovimentacoes(filtro, this.value);
        });
    }

    window.filtrarHistorico = function () {
        var inicio = document.getElementById('filtroDataInicio')?.value || '';
        var fim = document.getElementById('filtroDataFim')?.value || '';
        renderHistorico(inicio, fim);
    };

    window.limparFiltroHistorico = function () {
        var elInicio = document.getElementById('filtroDataInicio');
        var elFim = document.getElementById('filtroDataFim');
        if (elInicio) elInicio.value = '';
        if (elFim) elFim.value = '';
        renderHistorico();
    };

    window.gerarRelatorioEstoque = function () {
        var produtos = DB.getAll('estoque');

        var relatorio = '============================================\n';
        relatorio += 'RELATÓRIO DE ESTOQUE\n';
        relatorio += 'Data: ' + new Date().toLocaleString('pt-BR') + '\n';
        relatorio += '============================================\n\n';

        relatorio += 'Total de Produtos: ' + produtos.length + '\n';
        relatorio += 'Total de Itens: ' + produtos.reduce(function (sum, p) { return sum + p.quantidade; }, 0) + '\n';
        relatorio += 'Produtos com Estoque Baixo: ' + produtos.filter(function (p) { return p.quantidade <= p.minimo; }).length + '\n\n';

        relatorio += '--- PRODUTOS ---\n';
        produtos.forEach(function (p) {
            var status = p.quantidade <= 0 ? 'ESGOTADO' :
                p.quantidade <= p.minimo ? 'BAIXO' : 'NORMAL';
            relatorio += p.codigo + ' | ' + p.nome + ' | ' + p.quantidade + ' ' + p.unidade + ' | ' + p.categoria + ' | ' + status + '\n';
        });

        relatorio += '\n============================================\n';

        abrirModal('📊 Relatório de Estoque', `
            <div style="background:#f8fbfd;padding:16px;border-radius:8px;font-family:monospace;white-space:pre-wrap;font-size:0.9rem;max-height:400px;overflow-y:auto;">
                ${relatorio}
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="fecharModal()">Fechar</button>
                <button class="btn-primary" onclick="baixarRelatorioEstoque()"><i class="fas fa-download"></i> Baixar</button>
            </div>
        `);

        window._relatorioEstoque = relatorio;
    };

    window.baixarRelatorioEstoque = function () {
        if (!window._relatorioEstoque) return;
        var blob = new Blob([window._relatorioEstoque], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'relatorio_estoque_' + new Date().toISOString().split('T')[0] + '.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    window.exportarEstoqueCSV = function () {
        var produtos = DB.getAll('estoque');

        var csv = 'Código,Nome,Categoria,Quantidade,Unidade,Mínimo,Localização,Fornecedor,Valor Custo,Valor Venda\n';
        produtos.forEach(function (p) {
            csv += p.codigo + ',' + p.nome + ',' + p.categoria + ',' + p.quantidade + ',' + p.unidade + ',' + p.minimo + ',' + (p.localizacao || '') + ',' + (p.fornecedor || '') + ',' + (p.valorCusto || 0) + ',' + (p.valorVenda || 0) + '\n';
        });

        var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'estoque_' + new Date().toISOString().split('T')[0] + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // =============================================
    // ===== TABS =====
    // =============================================
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
            document.querySelectorAll('.tab-content').forEach(function (t) { t.classList.remove('active'); });
            this.classList.add('active');
            var tabContent = document.getElementById('tab-' + this.dataset.tab);
            if (tabContent) tabContent.classList.add('active');

            if (this.dataset.tab === 'movimentacoes') {
                renderMovimentacoes();
            } else if (this.dataset.tab === 'historico') {
                renderHistorico();
            } else if (this.dataset.tab === 'relatorio-estoque') {
                atualizarGraficosEstoque();
            }
        });
    });

    // =============================================
    // ===== MODAL GERAL =====
    // =============================================
    function abrirModal(titulo, conteudo) {
        var titleEl = document.getElementById('modalTitle');
        var bodyEl = document.getElementById('modalBody');
        var overlay = document.getElementById('modalOverlay');

        if (titleEl) titleEl.textContent = titulo;
        if (bodyEl) bodyEl.innerHTML = conteudo;
        if (overlay) overlay.classList.add('active');
    }
    window.abrirModal = abrirModal;

    window.fecharModal = function () {
        var overlay = document.getElementById('modalOverlay');
        if (overlay) overlay.classList.remove('active');
    };

    var modalClose = document.getElementById('modalClose');
    if (modalClose) modalClose.addEventListener('click', fecharModal);
    var modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', function (e) {
            if (e.target === this) fecharModal();
        });
    }

    // =============================================
    // ===== NAVEGAÇÃO =====
    // =============================================
    function setActivePage(pageId) {
        document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
        var target = document.getElementById('page-' + pageId);
        if (target) target.classList.add('active');
        document.querySelectorAll('.nav-menu ul li').forEach(function (li) { li.classList.remove('active'); });
        var activeLi = document.querySelector('.nav-menu ul li[data-page="' + pageId + '"]');
        if (activeLi) activeLi.classList.add('active');
    }

    document.querySelectorAll('.nav-menu ul li').forEach(function (li) {
        li.addEventListener('click', function () {
            var page = this.dataset.page;
            if (page) {
                setActivePage(page);
                renderAll();
            }
        });
    });

    // =============================================
    // ===== FUNÇÕES DE ADMINISTRAÇÃO =====
    // =============================================

    function carregarInfoAdministracao() {
        try {
            const empresaId = EmpresaManager.getEmpresaAtual();
            if (typeof PlanService === 'undefined') return;

            const resumo = PlanService.getResumoPlano(empresaId);
            const empresa = EmpresaManager.getEmpresa(empresaId);

            const elTotalAdmins = document.getElementById('adminTotalAdmins');
            const elPlanoAtual = document.getElementById('adminPlanoAtual');
            const elLimiteUso = document.getElementById('adminLimiteUso');
            const elVagasRestantes = document.getElementById('adminVagasRestantes');

            if (elTotalAdmins) elTotalAdmins.textContent = resumo.adminsAtuais;
            if (elPlanoAtual) elPlanoAtual.textContent = resumo.planoNome;
            if (elLimiteUso) elLimiteUso.textContent = resumo.porcentagemUso + '%';
            if (elVagasRestantes) elVagasRestantes.textContent = Math.max(0, resumo.limiteAdmins - resumo.adminsAtuais);

            const elEmpresaNome = document.getElementById('adminEmpresaNome');
            const elEmpresaId = document.getElementById('adminEmpresaId');
            const elTotalUsuarios = document.getElementById('adminTotalUsuarios');

            if (elEmpresaNome) elEmpresaNome.textContent = empresa ? empresa.nome : 'N/A';
            if (elEmpresaId) elEmpresaId.textContent = empresaId;
            if (elTotalUsuarios) elTotalUsuarios.textContent = resumo.adminsAtuais;

            const dbStatus = document.getElementById('adminDbStatus');
            if (dbStatus) {
                const isAvailable = typeof FirestoreService !== 'undefined' && FirestoreService._isFirestoreAvailable();
                dbStatus.textContent = isAvailable ? 'Firestore ✅' : 'Local ⚠️';
                dbStatus.style.color = isAvailable ? '#1d7a6b' : '#e67e22';
            }

            preencherInfoPlanoAdmin();
            carregarListaAdmins();

        } catch (e) {
            console.warn('Erro ao carregar informações de administração:', e);
        }
    }

    function preencherInfoPlanoAdmin() {
        try {
            const empresaId = EmpresaManager.getEmpresaAtual();
            if (typeof PlanService === 'undefined') return;

            const resumo = PlanService.getResumoPlano(empresaId);
            const container = document.getElementById('planoInfoContainer');
            if (!container) return;

            const cores = {
                'Grátis': '#1d7a6b',
                'Básico': '#3498db',
                'Profissional': '#8e44ad',
                'Empresarial': '#e67e22',
                'Personalizado': '#c0392b'
            };

            const cor = cores[resumo.planoNome] || '#0b2a3b';
            const estaLimite = resumo.estaLimite;
            const estaProximo = resumo.estaProximo;

            container.innerHTML = `
                <div style="background:#f8fbfd;padding:16px;border-radius:12px;border-left:4px solid ${cor};">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                        <div>
                            <div style="font-weight:700;color:#0b2a3b;font-size:1.1rem;display:flex;align-items:center;gap:8px;">
                                ${resumo.planoNome}
                                <span style="font-size:0.8rem;color:${estaLimite ? '#b13e3a' : estaProximo ? '#e67e22' : '#1d7a6b'};">
                                    ${estaLimite ? '🔴 Limite Atingido' : estaProximo ? '🟡 Próximo do Limite' : '🟢 OK'}
                                </span>
                            </div>
                            <div style="color:#4d687a;font-size:0.85rem;">
                                ${resumo.adminsAtuais} de ${resumo.limiteAdmins} administradores utilizados
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:1.2rem;font-weight:700;color:${cor};">
                                ${typeof resumo.precoMensal === 'number' ? 'R$ ' + resumo.precoMensal.toFixed(2) + '/mês' : resumo.precoMensal}
                            </div>
                            <div style="font-size:0.75rem;color:#4d687a;">${resumo.porcentagemUso}% utilizado</div>
                        </div>
                    </div>
                    <div style="margin-top:8px;height:6px;background:#e8eff5;border-radius:3px;overflow:hidden;">
                        <div style="height:100%;width:${Math.min(resumo.porcentagemUso, 100)}%;background:${estaLimite ? '#b13e3a' : estaProximo ? '#e67e22' : '#1d7a6b'};border-radius:3px;transition:width 0.5s ease;"></div>
                    </div>
                    <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
                        ${resumo.features.slice(0, 6).map(f =>
                `<span style="background:#e8eff5;padding:2px 12px;border-radius:12px;font-size:0.75rem;color:#1f3a4b;">${f}</span>`
            ).join('')}
                        ${resumo.features.length > 6 ? `<span style="background:#e8eff5;padding:2px 12px;border-radius:12px;font-size:0.75rem;color:#1f3a4b;">+${resumo.features.length - 6} mais</span>` : ''}
                    </div>
                    ${estaLimite ? `
                        <div style="margin-top:12px;padding:10px 14px;background:#fde2e0;border-radius:8px;border-left:3px solid #b13e3a;">
                            <div style="color:#b13e3a;font-weight:600;font-size:0.9rem;">
                                <i class="fas fa-exclamation-triangle"></i> Limite de administradores atingido!
                            </div>
                            <div style="color:#4d687a;font-size:0.85rem;margin-top:4px;">
                                Para adicionar mais administradores, faça upgrade de plano.
                            </div>
                        </div>
                    ` : estaProximo ? `
                        <div style="margin-top:12px;padding:10px 14px;background:#fff2d0;border-radius:8px;border-left:3px solid #e67e22;">
                            <div style="color:#8e6100;font-weight:600;font-size:0.9rem;">
                                <i class="fas fa-info-circle"></i> Próximo do limite de administradores
                            </div>
                            <div style="color:#4d687a;font-size:0.85rem;margin-top:4px;">
                                Restam ${resumo.limiteAdmins - resumo.adminsAtuais} vagas. Considere fazer upgrade de plano.
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        } catch (e) {
            console.warn('Erro ao preencher informações do plano:', e);
        }
    }

    function carregarListaAdmins() {
        try {
            const empresaId = EmpresaManager.getEmpresaAtual();
            const empresa = EmpresaManager.getEmpresa(empresaId);
            const tbody = document.getElementById('tabelaAdmins');

            if (!tbody) return;

            if (!empresa || !empresa.admins || empresa.admins.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#999;padding:20px;">Nenhum administrador cadastrado</td></tr>';
                return;
            }

            tbody.innerHTML = empresa.admins.map((admin, index) => {
                const dataAdicionado = admin.adicionadoEm ? new Date(admin.adicionadoEm).toLocaleDateString('pt-BR') : 'N/A';
                const isCurrentUser = admin.usuarioId === EmpresaManager.getUsuarioAtual();
                return `
                    <tr>
                        <td><strong>${admin.nome || 'N/A'}</strong> ${isCurrentUser ? '<span style="font-size:0.7rem;color:#1d7a6b;">(Você)</span>' : ''}</td>
                        <td>${admin.email || 'N/A'}</td>
                        <td>${dataAdicionado}</td>
                        <td>
                            ${!isCurrentUser ? `<i class="fas fa-trash" onclick="removerAdmin('${admin.usuarioId}')" title="Remover" style="color:#b13e3a;cursor:pointer;"></i>` :
                        `<span style="color:#999;font-size:0.7rem;">Admin atual</span>`}
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (e) {
            console.warn('Erro ao carregar lista de administradores:', e);
        }
    }

    window.removerAdmin = function (usuarioId) {
        if (!confirm('Tem certeza que deseja remover este administrador?')) {
            return;
        }

        try {
            const empresaId = EmpresaManager.getEmpresaAtual();
            const empresa = EmpresaManager.getEmpresa(empresaId);

            if (!empresa) return;

            empresa.admins = empresa.admins.filter(a => a.usuarioId !== usuarioId);

            const empresas = JSON.parse(localStorage.getItem('dedetiza_empresas') || '{}');
            empresas[empresaId] = empresa;
            localStorage.setItem('dedetiza_empresas', JSON.stringify(empresas));

            EmpresaManager._empresas[empresaId] = empresa;

            const sessoes = JSON.parse(localStorage.getItem('dedetiza_sessoes') || '{}');
            const key = empresaId + '_' + usuarioId;
            delete sessoes[key];
            localStorage.setItem('dedetiza_sessoes', JSON.stringify(sessoes));

            carregarListaAdmins();
            carregarInfoAdministracao();

            alert('✅ Administrador removido com sucesso!');
        } catch (e) {
            console.warn('Erro ao remover administrador:', e);
            alert('❌ Erro ao remover administrador: ' + e.message);
        }
    };

    window.abrirUpgradeModal = function () {
        const empresaId = EmpresaManager.getEmpresaAtual();
        if (typeof PlanService === 'undefined') {
            alert('Serviço de planos não disponível.');
            return;
        }
        const modalHtml = PlanService.gerarModalUpgrade(empresaId);
        abrirModal('📊 Upgrade de Plano', modalHtml);
    };

    window.recarregarInfoPlano = function () {
        carregarInfoAdministracao();
        alert('✅ Informações atualizadas!');
    };

    // =============================================
    // ===== INDICADOR DE PLANO NO TOPBAR =====
    // =============================================

    function adicionarIndicadorPlano() {
        try {
            const empresaId = EmpresaManager.getEmpresaAtual();
            if (typeof PlanService === 'undefined') return;

            const resumo = PlanService.getResumoPlano(empresaId);

            const existing = document.querySelector('.topbar-plano');
            if (existing) existing.remove();

            const planoIndicator = document.createElement('span');
            planoIndicator.className = 'topbar-plano';
            planoIndicator.style.cssText = `
                font-size: 0.75rem;
                padding: 4px 14px;
                border-radius: 20px;
                background: ${resumo.estaLimite ? '#b13e3a' : resumo.estaProximo ? '#e67e22' : '#1d7a6b'};
                color: white;
                margin-right: 12px;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                cursor: pointer;
            `;
            planoIndicator.innerHTML = `
                <i class="fas fa-crown"></i>
                ${resumo.planoNome}
                ${resumo.estaLimite ? '🔴' : resumo.estaProximo ? '🟡' : '🟢'}
            `;
            planoIndicator.title = `${resumo.adminsAtuais}/${resumo.limiteAdmins} administradores • ${resumo.porcentagemUso}% usado`;
            planoIndicator.onclick = () => abrirUpgradeModal();

            const topbarUser = document.querySelector('.topbar-user');
            if (topbarUser) {
                topbarUser.insertBefore(planoIndicator, topbarUser.firstChild);
            }
        } catch (e) {
            console.warn('Erro ao adicionar indicador de plano:', e);
        }
    }

    // =============================================
    // ===== BOTÃO NOVO ADMIN =====
    // =============================================

    document.addEventListener('DOMContentLoaded', function () {
        const btnNovoAdmin = document.getElementById('btnNovoAdmin');
        if (btnNovoAdmin) {
            btnNovoAdmin.addEventListener('click', function () {
                const empresaId = EmpresaManager.getEmpresaAtual();
                if (typeof PlanService === 'undefined') {
                    alert('Serviço de planos não disponível.');
                    return;
                }

                const verificacao = PlanService.verificarCadastroAdmin(empresaId);

                if (!verificacao.permitido) {
                    const modalHtml = PlanService.gerarModalUpgrade(empresaId);
                    abrirModal('🔒 Limite de Administradores Atingido', modalHtml);
                    return;
                }

                abrirModal('Novo Administrador', `
                    <div class="form-group">
                        <label>Nome Completo *</label>
                        <input type="text" id="modalAdminNome" placeholder="Nome do administrador" />
                    </div>
                    <div class="form-group">
                        <label>Email *</label>
                        <input type="email" id="modalAdminEmail" placeholder="email@exemplo.com" />
                    </div>
                    <div class="form-group">
                        <label>Usuário *</label>
                        <input type="text" id="modalAdminUsuario" placeholder="Usuário de acesso" />
                    </div>
                    <div class="form-group">
                        <label>Senha *</label>
                        <input type="password" id="modalAdminSenha" placeholder="Mínimo 6 caracteres" minlength="6" />
                    </div>
                    <div class="form-group">
                        <label>Confirmar Senha *</label>
                        <input type="password" id="modalAdminConfirm" placeholder="Confirme a senha" />
                    </div>
                    ${verificacao.tipo === 'aviso' ? `
                        <div style="background:#fff2d0;padding:12px 16px;border-radius:8px;border-left:4px solid #e67e22;margin-bottom:12px;">
                            <div style="color:#8e6100;font-size:0.9rem;">
                                <i class="fas fa-info-circle"></i> ${verificacao.mensagem}
                            </div>
                        </div>
                    ` : ''}
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="fecharModal()">Cancelar</button>
                        <button class="btn-primary" onclick="criarNovoAdmin()"><i class="fas fa-user-plus"></i> Criar</button>
                    </div>
                `);
            });
        }
    });

    window.criarNovoAdmin = function () {
        const nome = document.getElementById('modalAdminNome')?.value || '';
        const usuario = document.getElementById('modalAdminUsuario')?.value || '';
        const email = document.getElementById('modalAdminEmail')?.value || '';
        const senha = document.getElementById('modalAdminSenha')?.value || '';
        const confirm = document.getElementById('modalAdminConfirm')?.value || '';

        if (!nome || !usuario || !email || !senha || !confirm) {
            alert('Preencha todos os campos!');
            return;
        }

        if (senha !== confirm) {
            alert('As senhas não coincidem!');
            return;
        }

        if (senha.length < 6) {
            alert('A senha deve ter pelo menos 6 caracteres!');
            return;
        }

        const empresaId = EmpresaManager.getEmpresaAtual();

        if (typeof PlanService !== 'undefined') {
            const verificacao = PlanService.verificarCadastroAdmin(empresaId);
            if (!verificacao.permitido) {
                const modalHtml = PlanService.gerarModalUpgrade(empresaId);
                abrirModal('🔒 Limite de Administradores Atingido', modalHtml);
                return;
            }
        }

        if (typeof AuthService === 'undefined') {
            alert('Serviço de autenticação não disponível.');
            return;
        }

        AuthService.cadastrar(email, senha, nome, usuario, empresaId).then(result => {
            if (result.success) {
                fecharModal();
                carregarListaAdmins();
                carregarInfoAdministracao();
                alert('✅ Administrador criado com sucesso!');
            } else {
                alert('❌ Erro ao criar administrador: ' + result.message);
            }
        }).catch(err => {
            alert('❌ Erro ao criar administrador: ' + err.message);
        });
    };

    // =============================================
    // ===== INICIALIZAÇÃO DA PÁGINA ADMIN =====
    // =============================================

    document.addEventListener('DOMContentLoaded', function () {
        const observer = new MutationObserver(function () {
            const adminPage = document.getElementById('page-admin');
            if (adminPage && adminPage.classList.contains('active')) {
                carregarInfoAdministracao();
            }
        });

        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class'],
            subtree: true
        });

        setTimeout(() => {
            const adminPage = document.getElementById('page-admin');
            if (adminPage && adminPage.classList.contains('active')) {
                carregarInfoAdministracao();
            }
        }, 500);
    });

    // =============================================
    // ===== INICIALIZAÇÃO =====
    // =============================================
    resetarSessaoAtual();
    verificarZeramentoMensal();
    DB.init();
    carregarDadosUsuario().catch(function (err) { console.warn('Erro ao carregar dados do usuário:', err); });
    inicializarEventListeners();

    renderAll();

    setTimeout(function () {
        adicionarIndicadorPlano();
    }, 500);

    if (typeof FirestoreService !== 'undefined' && Object.keys(FirestoreService._unsubscribers).length === 0) {
        FirestoreService.iniciarObservadores(() => {
            if (typeof window.renderAll === 'function') {
                window.renderAll();
            }
        });
    }

    if (window.innerWidth <= 820) {
        if (sidebar) sidebar.style.width = '80px';
        document.querySelectorAll('.brand span, .nav-menu ul li span, .sidebar-footer span').forEach(function (s) {
            if (s) s.style.display = 'none';
        });
    }

    // =============================================
    // ===== CORREÇÃO: EXPORTAÇÃO DE FUNÇÕES DE CERTIFICADO =====
    // =============================================

    // 🔥 VISUALIZAR CERTIFICADO
    window.visualizarCertificado = function (id) {
        try {
            if (typeof DB === 'undefined') {
                console.warn('DB não disponível');
                alert('Sistema não disponível. Tente novamente.');
                return;
            }

            var certificado = CertificadoService.getCertificado(id);
            if (!certificado) {
                alert('Certificado não encontrado!');
                return;
            }

            var html = CertificadoService.renderizarCertificado(certificado);
            
            // Adiciona botões de ação no modal
            html += `
                <div style="margin-top:20px;display:flex;gap:12px;justify-content:flex-end;border-top:1px solid #e8eff5;padding-top:20px;">
                    <button class="btn-secondary" onclick="fecharModalRelatorio()">Fechar</button>
                    <button class="btn-primary" onclick="imprimirCertificado('${id}')"><i class="fas fa-print"></i> Imprimir</button>
                    <button class="btn-primary" onclick="baixarPDFCertificado('${id}')"><i class="fas fa-file-pdf"></i> Baixar PDF</button>
                </div>
            `;

            var titleEl = document.getElementById('modalRelatorioTitle');
            var bodyEl = document.getElementById('modalRelatorioBody');
            if (titleEl) titleEl.textContent = 'Certificado Técnico - ' + certificado.tipo;
            if (bodyEl) bodyEl.innerHTML = html;
            
            var overlay = document.getElementById('modalRelatorioOverlay');
            if (overlay) overlay.classList.add('active');
            
        } catch (e) {
            console.warn('Erro ao visualizar certificado:', e);
            alert('Erro ao visualizar certificado: ' + e.message);
        }
    };

    // 🔥 IMPRIMIR CERTIFICADO
    window.imprimirCertificado = function (id) {
        try {
            if (typeof DB === 'undefined') {
                alert('Sistema não disponível. Tente novamente.');
                return;
            }

            var certificado = CertificadoService.getCertificado(id);
            if (!certificado) {
                alert('Certificado não encontrado!');
                return;
            }

            CertificadoService.gerarPDF(certificado);
        } catch (e) {
            console.warn('Erro ao imprimir certificado:', e);
            alert('Erro ao imprimir certificado: ' + e.message);
        }
    };

    // 🔥 BAIXAR PDF DO CERTIFICADO
    window.baixarPDFCertificado = function (id) {
        try {
            if (typeof DB === 'undefined') {
                alert('Sistema não disponível. Tente novamente.');
                return;
            }

            var certificado = CertificadoService.getCertificado(id);
            if (!certificado) {
                alert('Certificado não encontrado!');
                return;
            }

            CertificadoService.gerarPDF(certificado);
        } catch (e) {
            console.warn('Erro ao baixar PDF do certificado:', e);
            alert('Erro ao baixar PDF: ' + e.message);
        }
    };

    // 🔥 EXCLUIR CERTIFICADO
    window.excluirCertificado = function (id) {
        if (!confirm('Tem certeza que deseja excluir este certificado?')) {
            return;
        }
        
        try {
            DB.remove('certificados', id);
            DB.forceClearCache('certificados');
            renderCertificados();
            preencherFiltroCertificados();
            renderAll();
            alert('✅ Certificado excluído com sucesso!');
        } catch (e) {
            console.warn('Erro ao excluir certificado:', e);
            alert('Erro ao excluir certificado: ' + e.message);
        }
    };

    // 🔥 EXPORTAR CERTIFICADOS EXCEL
    window.exportarCertificadosExcel = function () {
        try {
            if (typeof DB === 'undefined') {
                alert('Sistema não disponível. Tente novamente.');
                return;
            }

            var certificados = CertificadoService.listarCertificados();
            
            var data = certificados.map(function(c) {
                var cliente = getCliente(c.clienteId);
                return {
                    'ID': c.id,
                    'Cliente': cliente ? cliente.nome : 'N/A',
                    'Tipo': c.tipo,
                    'Data Emissão': new Date(c.criadoEm).toLocaleDateString('pt-BR'),
                    'Data Serviço': c.dataServico,
                    'Validade': c.dataValidade,
                    'Status': c.status,
                    'Observações': c.observacoes ? c.observacoes.substring(0, 100) : ''
                };
            });

            var wb = XLSX.utils.book_new();
            var ws = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, 'Certificados');
            XLSX.writeFile(wb, 'certificados_' + new Date().toISOString().split('T')[0] + '.xlsx');
        } catch (e) {
            console.warn('Erro ao exportar certificados:', e);
            alert('Erro ao exportar certificados: ' + e.message);
        }
    };

    // 🔥 EXPORTAR CERTIFICADOS PDF
    window.exportarCertificadosPDF = function () {
        try {
            if (typeof DB === 'undefined') {
                alert('Sistema não disponível. Tente novamente.');
                return;
            }

            var certificados = CertificadoService.listarCertificados();
            
            var doc = new window.jspdf.jsPDF('p', 'mm', 'a4');
            doc.setFontSize(14);
            doc.text('Relatório de Certificados Técnicos', 105, 20, { align: 'center' });
            doc.setFontSize(10);
            doc.text('Gerado em: ' + new Date().toLocaleString('pt-BR'), 105, 28, { align: 'center' });

            var data = certificados.map(function(c) {
                var cliente = getCliente(c.clienteId);
                return [
                    c.id,
                    cliente ? cliente.nome : 'N/A',
                    c.tipo,
                    new Date(c.criadoEm).toLocaleDateString('pt-BR'),
                    c.dataValidade,
                    c.status
                ];
            });

            if (data.length === 0) {
                doc.text('Nenhum certificado encontrado.', 20, 40);
            } else {
                doc.autoTable({
                    startY: 35,
                    head: [['ID', 'Cliente', 'Tipo', 'Emissão', 'Validade', 'Status']],
                    body: data,
                    theme: 'striped',
                    headStyles: { fillColor: [11, 42, 59] },
                    styles: { fontSize: 8 }
                });
            }

            doc.save('certificados_' + new Date().toISOString().split('T')[0] + '.pdf');
        } catch (e) {
            console.warn('Erro ao exportar certificados PDF:', e);
            alert('Erro ao exportar certificados: ' + e.message);
        }
    };
    
})();