/// Port of getSearchUrl() from App.tsx.
String getSearchUrl(String text) {
  final value = text.trim();
  if (value.isEmpty) return '';

  final isUrl = RegExp(
    r'^(https?:\/\/)?(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?([/?#]\S*)?$',
    caseSensitive: false,
  ).hasMatch(value);

  if (isUrl) {
    if (RegExp(r'^https?:\/\/', caseSensitive: false).hasMatch(value)) {
      return value;
    }
    return 'https://$value';
  }

  return 'https://www.google.com/search?q=${Uri.encodeComponent(value)}';
}
