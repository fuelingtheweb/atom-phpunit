'use babel';

import 'atom';
import { CompositeDisposable } from 'atom';
import Storage from './storage.js';
import child_process from 'child_process';
import AtomPhpunitView from './atom-phpunit-view.js';

export default {

    config: {
        saveBeforeTest: {
            order: 1,
            description: 'Save current file before running test(s)',
            type: 'boolean',
            default: true,
        },
        successAsNotifications: {
            order: 2,
            description: 'Show successful output as a notification instead of using the output panel',
            type: 'boolean',
            default: true,
        },
        failuresAsNotifications: {
            order: 3,
            description: 'Show failures output as a notification instead of using the output panel',
            type: 'boolean',
            default: false,
        },
        useVendor: {
            order: 4,
            description: 'Uses the project\'s phpunit binary (./vendor/bin/phpunit)',
            type: 'boolean',
            default: true,
        },
        phpunitPath: {
            order: 5,
            title: 'PHPUnit Binary Path',
            description: 'Used only if \'Use Vendor\' is not ticked.',
            type: 'string',
            default: '/usr/local/bin/phpunit',
        },
        outputViewFontSize: {
            order: 6,
            title: 'Output View Font Size',
            description: 'Set the font size of the PHPUnit Output view',
            type: 'string',
            default: '14px',
        },
        useTestFallback: {
            order: 7,
            description: 'Use fallback test if outside of test context',
            type: 'boolean',
            default: false,
        },
    },

    exec: null,

    activate(state) {
        process.env.PATH = String(child_process.execFileSync(
            process.env.SHELL,
            ['-c', 'source $HOME/.bash_profile; echo $PATH'],
        )).trim();
        this.exec = child_process.exec;
        this.storage = new Storage();
        this.errorView = new AtomPhpunitView(state.atomPhpunitViewState);
        this.outputPanel = atom.workspace.addBottomPanel({
            item: this.errorView.getElement(),
            visible: false,
        });

        atom.commands.add('atom-workspace', {
            'atom-phpunit:run-test': () => this.runTest(),
            'atom-phpunit:run-class': () => this.runClass(),
            'atom-phpunit:run-suite': () => this.runSuite(),
            'atom-phpunit:run-dusk-test': () => this.runDuskTest(),
            'atom-phpunit:run-dusk-class': () => this.runDuskClass(),
            'atom-phpunit:run-last-test': () => this.runLastTest(),
            'atom-phpunit:toggle-output': () => this.toggleOutput(),
            'atom-phpunit:hide-output': () => this.hideOutput(),
        });

        this.subscriptions = new CompositeDisposable();
        this.subscriptions.add(atom.commands.add('atom-workspace', 'core:cancel', this.handleEditorCancel));
    },

    serialize() {
        return {
            atomPhpunitViewState: this.errorView.serialize(),
        };
    },

    deactivate() {
        this.outputPanel.destroy();
        this.errorView.destroy();
        this.subscriptions.dispose();
        this.subscriptions = null;
    },

    runTest() {
        if (this.outputPanel.isVisible()) {
            this.errorView.update('No Output');
            this.hideOutput();
        }

        useTestFallback = atom.config.get('atom-phpunit.useTestFallback');
        filepath = this.getFilepath();
        if (!filepath) {
            if (useTestFallback) {
                return this.runLastTest();
            }

            atom.notifications.addError('Failed to get filename! Make sure you are in the test file you want run.');
            return;
        }

        func = this.getFunctionName();
        if (!func) {
            if (useTestFallback) {
                return this.runClass();
            }

            atom.notifications.addError('Function name not found! Make sure your cursor is inside the test you want to run.');
            return;
        }

        this.execute(filepath, func);
    },

    runDuskTest() {
        if (this.outputPanel.isVisible()) {
            this.errorView.update('No Output');
            this.hideOutput();
        }

        useTestFallback = atom.config.get('atom-phpunit.useTestFallback');
        filepath = this.getFilepath();
        if (!filepath) {
            if (useTestFallback) {
                return this.runLastTest();
            }

            atom.notifications.addError('Failed to get filename! Make sure you are in the test file you want run.');
            return;
        }

        func = this.getFunctionName();
        if (!func) {
            if (useTestFallback) {
                return this.runDuskClass();
            }

            atom.notifications.addError('Function name not found! Make sure your cursor is inside the test you want to run.');
            return;
        }

        this.executeDusk(filepath, func);
    },

    runClass() {
        if (this.outputPanel.isVisible()) {
            this.errorView.update('No Output');
            this.hideOutput();
        }
        filepath = this.getFilepath();
        if (!filepath) {
            if (atom.config.get('atom-phpunit.useTestFallback')) {
                return this.runLastTest();
            }

            atom.notifications.addError('Failed to get filename! Make sure you are in the test file you want run.');
            return;
        }

        this.execute(filepath);
    },

    runDuskClass() {
        if (this.outputPanel.isVisible()) {
            this.errorView.update('No Output');
            this.hideOutput();
        }
        filepath = this.getFilepath();
        if (!filepath) {
            if (atom.config.get('atom-phpunit.useTestFallback')) {
                return this.runLastTest();
            }

            atom.notifications.addError('Failed to get filename! Make sure you are in the test file you want run.');
            return;
        }

        this.executeDusk(filepath);
    },

    runSuite() {
        if (this.outputPanel.isVisible()) {
            this.errorView.update('No Output');
            this.hideOutput();
        }

        filepath = this.getFilepath(true);
        if (!filepath) {
            atom.notifications.addError('Failed to find phpunit! Make sure you are in the test file from the suit you want run.');
            return;
        }

        this.execute();
    },

    get lastTest() {
        return this.storage.get('lastTest') || {
            filepath: this.getFilepath() || undefined,
            functionName: this.getFunctionName() || undefined,
        };
    },

    set lastTest(test) {
        this.storage.put('lastTest', test);
    },

    get lastType() {
        return this.storage.get('lastType') || null;
    },

    set lastType(type) {
        this.storage.put('lastType', type);
    },

    runLastTest() {
        if (this.outputPanel.isVisible()) {
            this.errorView.update('No Output');
            this.hideOutput();
        }

        const { filepath, functionName } = this.lastTest;

        if (this.lastType === 'dusk') {
            return this.executeDusk(filepath, functionName);
        }

        this.execute(filepath, functionName);
    },

    handleEditorCancel: ({ target }) => {
        isMiniEditor = target.tagName === 'ATOM-TEXT-EDITOR' && target.hasAttribute('mini');
        panelIsVisible = this.default.outputPanel && this.default.outputPanel.isVisible();
        if (!isMiniEditor && panelIsVisible) {
            this.default.outputPanel.hide();
        }
    },

    toggleOutput() {
        this.outputPanel.isVisible()
            ? this.hideOutput()
            : this.showOutput();
    },

    showOutput() {
        this.outputPanel.show();
        this.toggleEditorClass(true);
    },

    hideOutput() {
        this.outputPanel.hide();
        this.toggleEditorClass(false);
    },

    toggleEditorClass(shouldAdd) {
        const editorView = atom.views.getView(atom.workspace.getActiveTextEditor());
        const method = shouldAdd ? 'add' : 'remove';
        console.log(method, editorView);
        editorView.classList[method]('phpunit-visible');
    },

    execute(filepath, functionName) {
        this.lastType = 'phpunit';
        this.lastTest = { filepath, functionName };

        if (atom.config.get('atom-phpunit.saveBeforeTest') &&
         atom.workspace.getActiveTextEditor().isModified()) { atom.workspace.getActiveTextEditor().save(); }

        if (atom.config.get('atom-phpunit.useVendor')) { cmd = `${this.getProjectFolderPath()}/vendor/bin/phpunit`; } else { cmd = atom.config.get('atom-phpunit.phpunitPath'); }

        if (typeof functionName !== 'undefined') { cmd += ` --filter=${functionName}$`; }

        if (typeof filepath !== 'undefined') { cmd += ` ${filepath}`; }

        console.log(`atom-phpunit: ${cmd}`);

        const phpunit = this.exec(cmd, { cwd: this.getProjectFolderPath() });

        let stdout = '';
        let stderr = '';

        // if (atom.config.get('atom-phpunit.failuresAsNotifications')) {
        this.errorView.update('', cmd, false, true);
        this.showOutput();
        // }

        phpunit.stdout.on('data', (data) => {
            stdout += data.toString();

            this.errorView.update(stdout, cmd, false, true);
        });

        phpunit.stderr.on('data', (data) => {
            stderr += data.toString();

            this.errorView.update(stderr, cmd, false, true);
        });

        phpunit.on('exit', (code) => {
            const error = code.toString() !== '0';

            if (error && stderr) {
                this.errorView.update(stderr, cmd, false);
                this.showOutput();
            } else if (error) {
                this.errorView.update(stdout, cmd, false);
                if (atom.config.get('atom-phpunit.failuresAsNotifications')) {
                    this.outputPanel.hide();
                    atom.notifications.addError('Test Failed!', { description: cmd, detail: stdout });
                } else {
                    this.outputPanel.show();
                }
            } else {
                this.errorView.update(stdout, cmd, true);
                if (atom.config.get('atom-phpunit.successAsNotifications')) {
                    this.outputPanel.hide();
                    atom.notifications.addSuccess('Test Passed!', { description: cmd, detail: stdout });
                }
            }
        });

        return phpunit;
    },

    executeDusk(filepath, functionName) {
        this.lastType = 'dusk';
        this.lastTest = { filepath, functionName };

        if (atom.config.get('atom-phpunit.saveBeforeTest') &&
         atom.workspace.getActiveTextEditor().isModified()) { atom.workspace.getActiveTextEditor().save(); }

        cmd = `php ${this.getProjectFolderPath()}/artisan dusk --without-tty`;

        if (typeof functionName !== 'undefined') { cmd += ` --filter=${functionName}$`; }

        if (typeof filepath !== 'undefined') { cmd += ` ${filepath}`; }

        console.log(`atom-phpunit: ${cmd}`);

        const phpunit = this.exec(cmd, { cwd: this.getProjectFolderPath() });

        let stdout = '';
        let stderr = '';

        // if (atom.config.get('atom-phpunit.failuresAsNotifications')) {
        this.errorView.update('', cmd, false, true);
        this.showOutput();
        // }

        phpunit.stdout.on('data', (data) => {
            stdout += data.toString();

            this.errorView.update(stdout, cmd, false, true);
        });

        phpunit.stderr.on('data', (data) => {
            stderr += data.toString();

            this.errorView.update(stderr, cmd, false, true);
        });

        phpunit.on('exit', (code) => {
            const error = code.toString() !== '0';

            if (error && stderr) {
                this.errorView.update(stderr, cmd, false);
                this.showOutput();
            } else if (error) {
                this.errorView.update(stdout, cmd, false);
                if (atom.config.get('atom-phpunit.failuresAsNotifications')) {
                    this.outputPanel.hide();
                    atom.notifications.addError('Test Failed!', { description: cmd, detail: stdout });
                } else {
                    this.outputPanel.show();
                }
            } else {
                this.errorView.update(stdout, cmd, true);
                if (atom.config.get('atom-phpunit.successAsNotifications')) {
                    this.outputPanel.hide();
                    atom.notifications.addSuccess('Test Passed!', { description: cmd, detail: stdout });
                }
            }
        });

        return phpunit;
    },

    getFunctionName() {
        const editor = atom.workspace.getActiveTextEditor();
        if (!editor) { return false; }

        const pos = editor.getCursorBufferPosition();
        const buffer = editor.getBuffer();

        for (let row = pos.row; row--; row > 0) {
            const line = buffer.lineForRow(row);
            if (line.includes('function ')) {
                const parts = line.match(/function\s+([^\s(]+)\s*\(/);
                if (parts && parts.length > 1) { return parts[1]; }
            }
        }

        return false;
    },

    getFilepath(skipTestCheck = false) {
        const editor = atom.workspace.getActivePaneItem();
        if (!editor) { return false; }

        const buffer = editor.buffer;
        if (!buffer) { return false; }

        const file = buffer.file;

        if (!file) {
            return false;
        }

        if (!file.path) {
            return false;
        }

        if (
            (!atom.config.get('atom-phpunit.useTestFallback') || !skipTestCheck)
      && !/test/i.test(file.path)
        ) {
            return false;
        }

        return file.path;
    },

    getProjectFolderPath() {
        return atom.project.relativizePath(this.getFilepath(true))[0];
    },

};
