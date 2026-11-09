import 'package:axiom_browser/utils.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('empty input returns empty', () => expect(getSearchUrl('  '), ''));
  test('domain gets https', () => expect(getSearchUrl('github.com'), 'https://github.com'));
  test('full url kept', () => expect(getSearchUrl('http://a.io/x?y=1'), 'http://a.io/x?y=1'));
  test('text becomes google search', () => expect(getSearchUrl('hello world'), 'https://www.google.com/search?q=hello%20world'));
}
