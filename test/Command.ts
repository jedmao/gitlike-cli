import * as chai from 'chai';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
const expect = chai.expect;
chai.use(sinonChai);

import Argument from '../lib/Argument';
import Command from '../lib/Command';
import Option from '../lib/Option';

describe('Command', () => {

    let cmd: Command;
    let help: sinon.SinonStub;
    beforeEach(() => {
        cmd = new Command();
        help = sinon.stub(cmd, 'help').returns(undefined);
    });

    it('outputs help information on -h or --help', () => {
        parse(cmd, '-h');
        expect(help).to.be.calledOnce;

        help.reset();

        parse(cmd, '--help');
        expect(help).to.be.calledOnce;
    });

    it('outputs version information on -v or --version', () => {
        cmd.version('0.1.2');
        const version = sinon.stub(cmd, 'version');

        parse(cmd, '-v');
        expect(version).to.be.calledOnce;

        version.reset();

        parse(cmd, '--version');
        expect(version).to.be.calledOnce;
    });

    it('supports sub-commands', () => {
        cmd.command('*');
        expect(cmd.commands).to.have.property('*').and.be.an.instanceof(Command);
        expect(cmd.commands.foo).to.not.equal(cmd);
    });

    it('supports options', () => {
        cmd.option('-f');
        expect((cmd as any)._options).to.have.property('f').and.be.instanceof(Option);
    });

    it('supports default values for options', () => {
        cmd.option('-f', null, 'bar');
        cmd.parse();
        expect(cmd.options).to.have.property('f').and.equal('bar');
    });

    it('supports arguments', () => {
        cmd.usage('<foo>');
        expect((cmd as any)._args[0]).to.be.instanceof(Argument);
    });

    it('supports repeating arguments', () => {
        cmd.usage('<foo>...');
        expect((cmd as any)._args[0]).to.have.property('repeating').and.be.true;

        cmd.usage('[<foo>...]');
        expect((cmd as any)._args[0]).to.have.property('repeating').and.be.true;
    });

    describe('Parsing', () => {

        it("doesn't error when no arguments are sent or required", () => {
            cmd.parse();
            parse(cmd, '');
        });

        it('parses solo short flags as true', () => {
            cmd.option('-f');
            parse(cmd, '-f');
            expect(cmd.options).to.have.property('f').and.be.true;
        });

        it('parses solo long flags as true', () => {
            cmd.option('--foo');
            parse(cmd, '--foo');
            expect(cmd.options).to.have.property('foo').and.be.true;
        });

        it('parses long flags with hyphens as camel-case', () => {
            cmd.option('--foo-bar');
            parse(cmd, '--foo-bar');
            expect(cmd.options).to.have.property('fooBar');
        });

        it('parses long flag as true when options has both short and long flags', () => {
            cmd.option('-f, --foo');
            parse(cmd, '-f');
            expect(cmd.options).not.to.have.property('f');
            expect(cmd.options).to.have.property('foo').and.be.true;
        });

        it('parses --no- and --not- flags to negate their true flags', () => {
            cmd.option('-F, --no-foo');
            cmd.option('-B, --not-bar');

            parse(cmd, '-F -B');
            expect(cmd.options).to.have.property('foo').and.be.false;
            expect(cmd.options).to.have.property('bar').and.be.false;

            parse(cmd, '--no-foo --not-bar');
            expect(cmd.options).to.have.property('foo').and.be.false;
            expect(cmd.options).to.have.property('bar').and.be.false;
        });

        it('parses optional flag values', () => {
            cmd.option('-f [bar]');
            parse(cmd, '-f');
            expect(cmd.options.f).to.be.undefined;

            cmd.option('-b [baz]', null, 'qux');
            parse(cmd, '-b');
            expect(cmd.options).to.have.property('b').and.equal('qux');

            parse(cmd, '-b foo');
            expect(cmd.options).to.have.property('b').and.equal('foo');
        });

        it('leaves args not consumed in args.etc', () => {
            cmd.usage('<foo> [bar]');
            cmd.option('-f <bar>');
            cmd.option('-b [qux]');

            parse(cmd, '-b a -f b c d e f g');
            expect(cmd.args).to.have.property('etc').and.deep.equal(['e', 'f', 'g']);
        });

        it('parses [foo] [bar] [baz] properly', () => {
            cmd.usage('[foo] [bar] [baz]');

            cmd.parse();
            expect(cmd.args).to.not.have.property('foo');
            expect(cmd.args).to.not.have.property('bar');
            expect(cmd.args).to.not.have.property('baz');

            parse(cmd, 'a');
            expect(cmd.args).to.have.property('foo').and.equal('a');
            expect(cmd.args).to.not.have.property('bar');
            expect(cmd.args).to.not.have.property('baz');

            parse(cmd, 'a b');
            expect(cmd.args).to.have.property('foo').and.equal('a');
            expect(cmd.args).to.have.property('bar').and.equal('b');
            expect(cmd.args).to.not.have.property('baz');

            parse(cmd, 'a b c');
            expect(cmd.args).to.have.property('foo').and.equal('a');
            expect(cmd.args).to.have.property('bar').and.equal('b');
            expect(cmd.args).to.have.property('baz').and.equal('c');
        });

        it('parses <foo> <bar> <baz> properly', () => {
            cmd.usage('<foo> <bar> <baz>');

            expect(parseTooFewArguments).to.throw(cmd.Error);
            function parseTooFewArguments() {
                parse(cmd, 'a b');
            }

            parse(cmd, 'a b c');
            expect(cmd.args).to.have.property('foo').and.equal('a');
            expect(cmd.args).to.have.property('bar').and.equal('b');
            expect(cmd.args).to.have.property('baz').and.equal('c');
        });

        it('parses <foo>... properly', () => {
            cmd.usage('<foo>...');

            expect(parseTooFewArguments).to.throw(cmd.Error);
            function parseTooFewArguments() {
                parse(cmd, '');
            }

            parse(cmd, 'a');
            expect(cmd.args).to.have.property('foo').and.deep.equal(['a']);

            parse(cmd, 'a b c');
            expect(cmd.args).to.have.property('foo').and.deep.equal(['a', 'b', 'c']);
        });

        it('parses <foo> [bar] <baz> properly', () => {
            cmd.usage('<foo> [bar] <baz>');

            expect(parseTooFewArguments).to.throw(cmd.Error);
            function parseTooFewArguments() {
                parse(cmd, 'a');
            }

            parse(cmd, 'a b');
            expect(cmd.args).to.have.property('foo').and.equal('a');
            expect(cmd.args).to.not.have.property('bar');
            expect(cmd.args).to.have.property('baz').and.equal('b');

            parse(cmd, 'x y z');
            expect(cmd.args).to.have.property('foo').and.equal('x');
            expect(cmd.args).to.have.property('bar').and.equal('y');
            expect(cmd.args).to.have.property('baz').and.equal('z');
        });

        it('parses [foo] <bar> <baz> properly', () => {
            cmd.usage('[foo] <bar> <baz>');

            expect(parseTooFewArguments).to.Throw(cmd.Error);
            function parseTooFewArguments() {
                parse(cmd, 'a');
            }

            parse(cmd, 'a b');
            expect(cmd.args).to.not.have.property('foo');
            expect(cmd.args).to.have.property('bar').and.equal('a');
            expect(cmd.args).to.have.property('baz').and.equal('b');

            parse(cmd, 'x y z');
            expect(cmd.args).to.have.property('foo').and.equal('x');
            expect(cmd.args).to.have.property('bar').and.equal('y');
            expect(cmd.args).to.have.property('baz').and.equal('z');
        });

        it('parses [foo] <bar> [<baz>...] properly', () => {
            cmd.usage('[foo] <bar> [<baz>...]');

            expect(parseTooFewArguments).to.throw(cmd.Error);
            function parseTooFewArguments() {
                parse(cmd, '');
            }

            parse(cmd, 'a');
            expect(cmd.args).to.not.have.property('foo');
            expect(cmd.args).to.have.property('bar').and.equal('a');
            expect(cmd.args).to.not.have.property('baz');

            parse(cmd, 'a b');
            expect(cmd.args).to.have.property('foo').and.equal('a');
            expect(cmd.args).to.have.property('bar').and.equal('b');
            expect(cmd.args).to.not.have.property('baz');

            parse(cmd, 'a b c');
            expect(cmd.args).to.have.property('foo').and.equal('a');
            expect(cmd.args).to.have.property('bar').and.equal('b');
            expect(cmd.args).to.have.property('baz').and.deep.equal(['c']);

            parse(cmd, 'a b c x y z');
            expect(cmd.args).to.have.property('foo').and.equal('a');
            expect(cmd.args).to.have.property('bar').and.equal('b');
            expect(cmd.args).to.have.property('baz').and.deep.equal(['c', 'x', 'y', 'z']);
        });

        it('parses <foo>... <bar> <baz> properly', () => {
            cmd.usage('<foo>... <bar> <baz>');

            expect(parseTooFewArguments).to.throw(cmd.Error);
            function parseTooFewArguments() {
                parse(cmd, 'a b');
            }

            parse(cmd, 'a b c');
            expect(cmd.args).to.have.property('foo').and.deep.equal(['a']);
            expect(cmd.args).to.have.property('bar').and.equal('b');
            expect(cmd.args).to.have.property('baz').and.equal('c');

            parse(cmd, 'a b c x y z');
            expect(cmd.args).to.have.property('foo').and.deep.equal(['a', 'b', 'c', 'x']);
            expect(cmd.args).to.have.property('bar').and.equal('y');
            expect(cmd.args).to.have.property('baz').and.deep.equal('z');
        });

        it('parses <foo> [<bar>...] <baz> properly', () => {
            cmd.usage('<foo> [<bar>...] <baz>');

            expect(parseTooFewArguments).to.throw(cmd.Error);
            function parseTooFewArguments() {
                parse(cmd, 'a');
            }

            parse(cmd, 'a b');
            expect(cmd.args).to.have.property('foo').and.equal('a');
            expect(cmd.args).to.not.have.property('bar');
            expect(cmd.args).to.have.property('baz').and.equal('b');

            parse(cmd, 'a b c x y z');
            expect(cmd.args).to.have.property('foo').and.equal('a');
            expect(cmd.args).to.have.property('bar').and.deep.equal(['b', 'c', 'x', 'y']);
            expect(cmd.args).to.have.property('baz').and.equal('z');
        });

        it('parses flags and arguments together', () => {
            cmd.usage('[foo] <bar>');
            cmd.option('-c, --color <color>');

            parse(cmd, '-c orange a b c');
            expect(cmd.options).to.have.property('color').and.equal('orange');
            expect(cmd.args).to.have.property('foo').and.equal('a');
            expect(cmd.args).to.have.property('bar').and.equal('b');
            expect(cmd.args).to.have.property('etc').and.deep.equal(['c']);
        });

        it('parses combo short flags', () => {
            cmd.option('-a');
            cmd.option('-b');
            cmd.option('-c');
            parse(cmd, '-abc');
            expect(cmd.options).to.have.property('a').and.be.true;
            expect(cmd.options).to.have.property('b').and.be.true;
            expect(cmd.options).to.have.property('c').and.be.true;
        });

        it('parses combo short flags with a value', () => {
            cmd.option('-a');
            cmd.option('-b');
            cmd.option('-c <foo>');
            parse(cmd, '-abc bar');
            expect(cmd.options).to.have.property('a').and.be.true;
            expect(cmd.options).to.have.property('b').and.be.true;
            expect(cmd.options).to.have.property('c').and.equal('bar');
        });

        it('parses combo short flags with opt/req values, followed by args', () => {
            cmd.usage('[foo] <bar>');
            cmd.option('-c, --color <color>');
            cmd.option('-F, --not-free');
            cmd.option('-q, --quantity <n>');

            parse(cmd, '-Fcq blue 10 a b c');
            expect(cmd.options).to.have.property('free').and.be.false;
            expect(cmd.options).to.have.property('color').and.equal('blue');
            expect(cmd.options).to.have.property('quantity').and.equal(10);
            expect(cmd.args).to.have.property('foo').and.equal('a');
            expect(cmd.args).to.have.property('bar').and.equal('b');
            expect(cmd.args).to.have.property('etc').and.deep.equal(['c']);

            cmd.option('-s, --size [size]', null, 'medium');

            parse(cmd, '-sFcq blue 10 -- a b c');
            expect(cmd.options).to.have.property('size').and.equal('medium');
            expect(cmd.options).to.have.property('free').and.be.false;
            expect(cmd.options).to.have.property('color').and.equal('blue');
            expect(cmd.options).to.have.property('quantity').and.equal(10);
            expect(cmd.args).to.have.property('foo').and.equal('a');
            expect(cmd.args).to.have.property('bar').and.equal('b');
            expect(cmd.args).to.have.property('etc').and.deep.equal(['c']);
        });

        it('supports the unparse command, which erases all parsed values', () => {
            cmd.usage('[foo] <bar>');
            cmd.option('-b, --baz');

            parse(cmd, '-b a b');
            expect(cmd).to.have.property('options');
            expect(cmd).to.have.property('args');

            cmd.unparse();
            expect(cmd).to.not.have.property('options');
            expect(cmd).to.not.have.property('args');
        });
    });
});

function parse(cmd: Command, line: string) {
    const args = line.split(/ +/);
    args.unshift.apply(args, new Array(2));
    return cmd.parse(args);
}
