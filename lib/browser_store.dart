import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// صفحة اتزارت.
class HistoryEntry {
  const HistoryEntry({
    required this.url,
    required this.title,
    required this.visitedAt,
  });

  final String url;
  final String title;
  final DateTime visitedAt;

  Map<String, dynamic> toJson() => {
    'url': url,
    'title': title,
    'at': visitedAt.millisecondsSinceEpoch,
  };

  factory HistoryEntry.fromJson(Map<String, dynamic> j) => HistoryEntry(
    url: j['url'] as String? ?? '',
    title: j['title'] as String? ?? '',
    visitedAt: DateTime.fromMillisecondsSinceEpoch(
      (j['at'] as num?)?.toInt() ?? 0,
    ),
  );
}

/// صفحة اتحفظت (نجمة).
class BookmarkEntry {
  const BookmarkEntry({
    required this.url,
    required this.title,
    required this.savedAt,
  });

  final String url;
  final String title;
  final DateTime savedAt;

  Map<String, dynamic> toJson() => {
    'url': url,
    'title': title,
    'at': savedAt.millisecondsSinceEpoch,
  };

  factory BookmarkEntry.fromJson(Map<String, dynamic> j) => BookmarkEntry(
    url: j['url'] as String? ?? '',
    title: j['title'] as String? ?? '',
    savedAt: DateTime.fromMillisecondsSinceEpoch(
      (j['at'] as num?)?.toInt() ?? 0,
    ),
  );
}

/// بيانات البروفايل المحلي.
class UserProfile {
  const UserProfile({this.name = 'Guest', this.email = ''});

  final String name;
  final String email;

  Map<String, dynamic> toJson() => {'name': name, 'email': email};

  factory UserProfile.fromJson(Map<String, dynamic> j) => UserProfile(
    name: j['name'] as String? ?? 'Guest',
    email: j['email'] as String? ?? '',
  );
}

/// شورتكت على الهوم (YouTube / GitHub / أي موقع اليوزر يضيفه).
class ShortcutEntry {
  const ShortcutEntry({
    required this.id,
    required this.name,
    required this.url,
    this.color = '#A78BFA',
  });

  final String id;
  final String name;
  final String url;
  final String color;

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'url': url,
    'color': color,
  };

  factory ShortcutEntry.fromJson(Map<String, dynamic> j) => ShortcutEntry(
    id: j['id'] as String? ?? '',
    name: j['name'] as String? ?? '',
    url: j['url'] as String? ?? '',
    color: j['color'] as String? ?? '#A78BFA',
  );
}

/// مخزن واحد للتاريخ والمحفوظات والبروفايل والشورتكت، بيتحفظ على الجهاز.
class BrowserStore extends ChangeNotifier {
  BrowserStore._();

  static final BrowserStore instance = BrowserStore._();

  static const String _historyKey = 'axiom_history_v1';
  static const String _bookmarksKey = 'axiom_bookmarks_v1';
  static const String _profileKey = 'axiom_profile_v1';
  static const String _shortcutsKey = 'axiom_shortcuts_v1';
  static const int _maxHistory = 500;

  static const List<ShortcutEntry> _defaultShortcuts = [
    ShortcutEntry(id: 'youtube', name: 'YouTube', url: 'https://youtube.com', color: '#FF0000'),
    ShortcutEntry(id: 'github', name: 'GitHub', url: 'https://github.com', color: '#FFFFFF'),
    ShortcutEntry(id: 'google', name: 'Google', url: 'https://google.com', color: '#4285F4'),
    ShortcutEntry(id: 'notion', name: 'Notion', url: 'https://notion.so', color: '#FFFFFF'),
  ];

  SharedPreferences? _prefs;
  Future<void>? _initFuture;

  List<HistoryEntry> _history = [];
  List<BookmarkEntry> _bookmarks = [];
  List<ShortcutEntry> _shortcuts = [];
  UserProfile _profile = const UserProfile();

  List<HistoryEntry> get history => List.unmodifiable(_history);
  List<BookmarkEntry> get bookmarks => List.unmodifiable(_bookmarks);
  List<ShortcutEntry> get shortcuts => List.unmodifiable(_shortcuts);
  UserProfile get profile => _profile;

  int get historyCount => _history.length;
  int get bookmarksCount => _bookmarks.length;
  int get shortcutsCount => _shortcuts.length;

  Future<void> init() => _initFuture ??= _load();

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _prefs = prefs;
      _history = _decodeList(prefs.getString(_historyKey), HistoryEntry.fromJson);
      _bookmarks =
          _decodeList(prefs.getString(_bookmarksKey), BookmarkEntry.fromJson);

      final rawShortcuts = prefs.getString(_shortcutsKey);
      if (rawShortcuts == null || rawShortcuts.isEmpty) {
        _shortcuts = List.from(_defaultShortcuts);
      } else {
        _shortcuts = _decodeList(rawShortcuts, ShortcutEntry.fromJson);
        if (_shortcuts.isEmpty) {
          _shortcuts = List.from(_defaultShortcuts);
        }
      }

      final rawProfile = prefs.getString(_profileKey);
      if (rawProfile != null && rawProfile.isNotEmpty) {
        final decoded = jsonDecode(rawProfile);
        if (decoded is Map<String, dynamic>) {
          _profile = UserProfile.fromJson(decoded);
        }
      }
    } catch (_) {
      _shortcuts = List.from(_defaultShortcuts);
    }
    notifyListeners();
  }

  List<T> _decodeList<T>(
      String? raw,
      T Function(Map<String, dynamic>) fromJson,
      ) {
    if (raw == null || raw.isEmpty) return [];
    final decoded = jsonDecode(raw);
    if (decoded is! List) return [];
    return decoded.whereType<Map<String, dynamic>>().map(fromJson).toList();
  }

  static String _normalize(String url) {
    var value = url.trim();
    while (value.endsWith('/')) {
      value = value.substring(0, value.length - 1);
    }
    return value;
  }

  // ---------------------------------------------------------------- History

  Future<void> addHistory(String url, String title) async {
    final clean = url.trim();
    if (!(clean.startsWith('http://') || clean.startsWith('https://'))) return;

    await init();

    final entry = HistoryEntry(
      url: clean,
      title: title.trim().isEmpty ? clean : title.trim(),
      visitedAt: DateTime.now(),
    );

    if (_history.isNotEmpty &&
        _normalize(_history.first.url) == _normalize(clean)) {
      _history[0] = entry;
    } else {
      _history.insert(0, entry);
      if (_history.length > _maxHistory) {
        _history = _history.sublist(0, _maxHistory);
      }
    }

    notifyListeners();
    await _saveHistory();
  }

  Future<void> removeHistory(HistoryEntry entry) async {
    _history.remove(entry);
    notifyListeners();
    await _saveHistory();
  }

  Future<void> clearHistory() async {
    _history = [];
    notifyListeners();
    await _saveHistory();
  }

  Future<void> _saveHistory() async {
    await init();
    await _prefs?.setString(
      _historyKey,
      jsonEncode(_history.map((e) => e.toJson()).toList()),
    );
  }

  // -------------------------------------------------------------- Bookmarks

  bool isBookmarked(String url) {
    final normalized = _normalize(url);
    if (normalized.isEmpty) return false;
    return _bookmarks.any((b) => _normalize(b.url) == normalized);
  }

  bool toggleBookmark(String url, String title) {
    final normalized = _normalize(url);
    if (normalized.isEmpty) return false;

    final index = _bookmarks.indexWhere((b) => _normalize(b.url) == normalized);
    if (index != -1) {
      _bookmarks.removeAt(index);
      notifyListeners();
      _saveBookmarks();
      return false;
    }

    _bookmarks.insert(
      0,
      BookmarkEntry(
        url: url.trim(),
        title: title.trim().isEmpty ? url.trim() : title.trim(),
        savedAt: DateTime.now(),
      ),
    );
    notifyListeners();
    _saveBookmarks();
    return true;
  }

  Future<void> removeBookmark(BookmarkEntry entry) async {
    _bookmarks.remove(entry);
    notifyListeners();
    await _saveBookmarks();
  }

  Future<void> _saveBookmarks() async {
    await init();
    await _prefs?.setString(
      _bookmarksKey,
      jsonEncode(_bookmarks.map((e) => e.toJson()).toList()),
    );
  }

  // ------------------------------------------------------------ Shortcuts

  Future<void> addShortcut(String name, String url, [String? color]) async {
    await init();
    final id = DateTime.now().millisecondsSinceEpoch.toString();
    _shortcuts.add(ShortcutEntry(
      id: id,
      name: name.trim().isEmpty ? 'Site' : name.trim(),
      url: url.trim(),
      color: color ?? '#A78BFA',
    ));
    notifyListeners();
    await _saveShortcuts();
  }

  Future<void> updateShortcut(String id, String name, String url) async {
    final idx = _shortcuts.indexWhere((s) => s.id == id);
    if (idx == -1) return;
    _shortcuts[idx] = ShortcutEntry(
      id: id,
      name: name.trim().isEmpty ? _shortcuts[idx].name : name.trim(),
      url: url.trim(),
      color: _shortcuts[idx].color,
    );
    notifyListeners();
    await _saveShortcuts();
  }

  Future<void> removeShortcut(String id) async {
    _shortcuts.removeWhere((s) => s.id == id);
    notifyListeners();
    await _saveShortcuts();
  }

  Future<void> _saveShortcuts() async {
    await init();
    await _prefs?.setString(
      _shortcutsKey,
      jsonEncode(_shortcuts.map((e) => e.toJson()).toList()),
    );
  }

  // ---------------------------------------------------------------- Profile

  Future<void> updateProfile({
    required String name,
    required String email,
  }) async {
    final cleanName = name.trim();
    _profile = UserProfile(
      name: cleanName.isEmpty ? 'Guest' : cleanName,
      email: email.trim(),
    );
    notifyListeners();
    await init();
    await _prefs?.setString(_profileKey, jsonEncode(_profile.toJson()));
  }
}