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

/// مخزن واحد للتاريخ والمحفوظات والبروفايل، بيتحفظ على الجهاز.
class BrowserStore extends ChangeNotifier {
  BrowserStore._();

  static final BrowserStore instance = BrowserStore._();

  static const String _historyKey = 'axiom_history_v1';
  static const String _bookmarksKey = 'axiom_bookmarks_v1';
  static const String _profileKey = 'axiom_profile_v1';
  static const int _maxHistory = 500;

  SharedPreferences? _prefs;
  Future<void>? _initFuture;

  List<HistoryEntry> _history = [];
  List<BookmarkEntry> _bookmarks = [];
  UserProfile _profile = const UserProfile();

  List<HistoryEntry> get history => List.unmodifiable(_history);
  List<BookmarkEntry> get bookmarks => List.unmodifiable(_bookmarks);
  UserProfile get profile => _profile;

  int get historyCount => _history.length;
  int get bookmarksCount => _bookmarks.length;

  Future<void> init() => _initFuture ??= _load();

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _prefs = prefs;
      _history = _decodeList(prefs.getString(_historyKey), HistoryEntry.fromJson);
      _bookmarks =
          _decodeList(prefs.getString(_bookmarksKey), BookmarkEntry.fromJson);

      final rawProfile = prefs.getString(_profileKey);
      if (rawProfile != null && rawProfile.isNotEmpty) {
        final decoded = jsonDecode(rawProfile);
        if (decoded is Map<String, dynamic>) {
          _profile = UserProfile.fromJson(decoded);
        }
      }
    } catch (_) {
      // لو التخزين مش متاح، بنكمل بقوائم فاضية
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

  /// بيحفظ الصفحة أو يشيلها. بيرجع true لو اتحفظت.
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
