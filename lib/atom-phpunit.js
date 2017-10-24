'use babel';

import 'atom';
import Storage from './storage.js';
import child_process from 'child_process';
import AtomPhpunitView from './atom-phpunit-view.js';

export default {

  config: {
    successAsNotifications: {
      order: 1,
      description: 'Show successful output as a notification instead of using the output panel',
      type: 'boolean',
      default: true
    },
    failuresAsNotifications: {
      order: 2,
      description: 'Show failures output as a notification instead of using the output panel',
      type: 'boolean',
      default: false
    },
    useVendor: {
      order: 3,
      description: 'Uses the project\'s phpunit binary (./vendor/bin/phpunit)',
      type: 'boolean',
      default: true
    },
    phpunitPath: {
      order: 4,
      title: 'PHPUnit Binary Path',
      description: 'Used only if \'Use Vendor\' is not ticked.',
      type: 'string',
      default: '/usr/local/bin/phpunit'
    },
    outputViewFontSize: {
      order: 5,
      title: 'Output View Font Size',
      description: 'Set the font size of the PHPUnit Output view',
      type: 'string',
      default: '14px'
    }
  },

  exec: null,

  activate(state) {
    process.env.PATH = String(
        child_process.execFileSync(
            process.env.SHELL,
            ['-c', 'source $HOME/.bash_profile; echo $PATH']
        )
    ).trim()
    this.exec = child_process.exec;
    this.storage = new Storage;
    this.errorView = new AtomPhpunitView(state.atomPhpunitViewState);
    this.outputPanel = atom.workspace.addBottomPanel({
      item: this.errorView.getElement(),
      visible: false
    });

    atom.commands.add('atom-workspace', {
      'atom-phpunit:run-test': () => this.runTest(),
      'atom-phpunit:run-class': () => this.runClass(),
      'atom-phpunit:run-suite': () => this.runSuite(),
      'atom-phpunit:run-last-test': () => this.runLastTest(),
      'atom-phpunit:toggle-output': () => this.toggleOutput(),
      'atom-phpunit:hide-output': () => this.hideOutput()
    });
  },

  serialize() {
    return {
      atomPhpunitViewState: this.errorView.serialize()
    };
  },

  deactivate() {
    this.outputPanel.destroy();
    this.errorView.destroy();
  },

  runTest() {
    if (this.outputPanel.isVisible()) {
      this.errorView.update('No Output');
      this.hideOutput();
    }

    filepath = this.getFilepath();
    if (!filepath) {
      return this.runLastTest();
    }

    func = this.getFunctionName();
    if (!func) {
      return this.runClass();
    }

    this.execute(filepath, func);
  },

  runClass() {
    if (this.outputPanel.isVisible()) {
      this.errorView.update('No Output');
      this.hideOutput();
    }
    filepath = this.getFilepath();
    if (!filepath) {
      return this.runLastTest();
    }

    this.execute(filepath);
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
    return this.storage.get("lastTest") || {
      filepath: this.getFilepath() || undefined,
      functionName: this.getFunctionName() || undefined,
    }
  },

  set lastTest(test) {
    this.storage.put("lastTest", test)
  },

  runLastTest() {
    if (this.outputPanel.isVisible()) {
      this.errorView.update('No Output');
      this.hideOutput();
    }

    const {filepath, functionName} = this.lastTest

    this.execute(filepath, functionName);
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
    this.lastTest = {filepath, functionName}

    if (atom.config.get('atom-phpunit.useVendor'))
      cmd = './vendor/bin/phpunit';
    else
      cmd = atom.config.get('atom-phpunit.phpunitPath');

    if (typeof functionName !== 'undefined')
      cmd += ` --filter=${functionName}`;

    if (typeof filepath !== 'undefined')
      cmd += ` ${filepath}`;

    console.log(`atom-phpunit: ${cmd}`);

    const phpunit = this.exec(cmd, {cwd: this.getProjectFolderPath()})

    let stdout = ""
    let stderr = ""

    if (!atom.config.get('atom-phpunit.failuresAsNotifications')) {
      this.errorView.update('', cmd, false, true);
      this.showOutput();
    }

    phpunit.stdout.on("data", (data) => {

      stdout += data.toString()

      this.errorView.update(stdout, cmd, false, true);
    });

    phpunit.stderr.on("data", (data) => {
      stderr += data.toString()

      this.errorView.update(stderr, cmd, false);
    });

    phpunit.on('exit', (code) => {
      const error = code.toString() !== '0'

      if (error && stderr) {
        this.errorView.update(stderr, cmd, false);
        this.showOutput();
      } else if (error) {
        this.errorView.update(stdout, cmd, false);
        if (atom.config.get('atom-phpunit.failuresAsNotifications')) {
          this.hideOutput();
          atom.notifications.addError('Test Failed!', {description: cmd, detail: stdout});
        } else {
          this.showOutput();
        }
      } else {
        this.errorView.update(stdout, cmd, true);
        if (atom.config.get('atom-phpunit.successAsNotifications')) {
          this.hideOutput();
          atom.notifications.addSuccess('Test Passed!', {description: cmd, detail: stdout});
        } else {
          this.showOutput();
        }
      }
    });
  },

  getFunctionName() {
    let editor = atom.workspace.getActiveTextEditor();
    if (!editor)
      return false;

    let pos = editor.getCursorBufferPosition();
    let buffer = editor.getBuffer();

    for (var row = pos.row; row--; row > 0) {
      let line = buffer.lineForRow(row);
      if (line.includes('function ')) {
        let parts = line.match(/function\s+([^\s(]+)\s*\(/);
        if (parts && parts.length > 1)
          return parts[1];
      }
    }

    return false
  },

  getFilepath(skipTestCheck = false) {
    let editor = atom.workspace.getActivePaneItem();
    if (!editor)
      return false;

    let buffer = editor.buffer;
    if (!buffer)
      return false;

    let file = buffer.file;

    if (!file) {
      return false;
    }

    if (!file.path) {
      return false;
    }

    if (!skipTestCheck && !/test/i.test(file.path)) {
      return false;
    }

    return file.path;
  },

  getProjectFolderPath() {
    return atom.project.relativizePath(this.getFilepath(true))[0];
  }

};
