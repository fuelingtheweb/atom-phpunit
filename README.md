# atom-phpunit package

Run phpunit and see the results all from inside atom.

## Commands
atom-phpunit comes with 4 commands:
* `run-test` - `Alt+Shift+T`
  * runs the current test lcoated using the cursor
* `run-class` - `Alt+Shift+C`
  * runs the current test class (open file)
* `run-suite` - `Alt+Shift+S`
  * runs phpunit without any filter
* `run-last-test` - `Alt+Shift+R`
  * reruns the last test/s
* `toggle-output` - `Alt+Shift+X`
  * toggles the output panel

## Settings
By default, atom-phpunit assumes you have used composer to pull in the `phpunit` package and uses the `./vendor/bin/phpunit` path. This can be altered in the settings by unchecking the 'Use Vendor' option and setting the path to your `phpunit` binary in the 'PHPUnit Path' setting.

Other confuration options include:
* Option to automatically save file before executing phpunit
* Successful tests as notifications
* Failures as notifications
* Output font size
* Option to configure a custom path to PHPUnit executable

## Preview
![Preview](https://github.com/Synapse791/atom-phpunit/raw/master/preview.gif)

## Tests
To run tests on this package:
```sh
$ git clone https://github.com/Synapse791/atom-phpunit.git
$ cd atom-phpunit
$ atom --test spec
```
