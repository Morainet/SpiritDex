"""递归下降 Lua 表解析器（仅标准库）。

BWIKI 的 ``Module:PetData/*`` 模块形如::

    return {key=val, ...}

特性（按实测语法）：
- 顶层 ``return {...}``；剥壳后解析一张表
- 无引号 key（``at=``、``pet_000001=``）与 ``["str"]=`` 两种写法
- 值类型：字符串 ``"..."``（含转义）、数字（int/负数/小数）、布尔 ``true``/``false``、
  ``nil``、表 ``{...}``（字典）、数组 ``{a, b, c}``（既有纯数组也有混合 dict）
- 尾逗号允许、空白可选

设计上对**未知 key**直接保留（不报错），交由 transformers 按需取字段；
解析失败抛 ``LuaParseError``，调用方决定隔离到 quarantine。
"""

from __future__ import annotations

from typing import Any


class LuaParseError(ValueError):
    """Lua 表解析失败。"""


class _Cursor:
    """带位置追踪的字符串游标。"""

    __slots__ = ("s", "i", "n")

    def __init__(self, s: str) -> None:
        self.s = s
        self.i = 0
        self.n = len(s)

    def ws(self) -> None:
        # 跳过空白与 Lua 长注释/行注释（数据里一般没有，稳妥起见支持）
        s, n = self.s, self.n
        while self.i < n:
            c = s[self.i]
            if c in " \t\r\n":
                self.i += 1
            elif c == "-" and self.i + 1 < n and s[self.i + 1] == "-":
                # 行注释 --xxx\n 或长注释 --[[ ... ]]
                if self.i + 3 < n and s[self.i + 2] == "[" and s[self.i + 3] == "[":
                    end = s.find("]]", self.i + 4)
                    self.i = n if end < 0 else end + 2
                else:
                    nl = s.find("\n", self.i)
                    self.i = n if nl < 0 else nl + 1
            else:
                break

    def peek(self) -> str:
        return self.s[self.i] if self.i < self.n else ""

    def eof(self) -> bool:
        self.ws()
        return self.i >= self.n


def parse_table_module(text: str) -> dict:
    """解析 ``return {...}`` 模块文本，返回顶层 dict。

    若顶层 return 的不是表（罕见），抛 ``LuaParseError``。
    """
    cur = _Cursor(text)
    cur.ws()
    # 定位 `return`
    if not _starts_with(cur, "return"):
        raise LuaParseError("未找到 'return'")
    _advance(cur, 6)
    cur.ws()
    if cur.peek() != "{":
        raise LuaParseError(f"return 后应为表，实际: {cur.s[cur.i:cur.i + 20]!r}")
    val = _parse_value(cur)
    cur.ws()
    if not cur.eof():
        # 尾部可能有残留（少见），容忍
        pass
    if not isinstance(val, dict):
        raise LuaParseError("顶层 return 值非表")
    return val


def _starts_with(cur: _Cursor, word: str) -> bool:
    return cur.s[cur.i:cur.i + len(word)] == word


def _advance(cur: _Cursor, k: int) -> None:
    cur.i += k


# ---- 值 / 表解析 -----------------------------------------------------------

def _parse_value(cur: _Cursor) -> Any:
    cur.ws()
    c = cur.peek()
    if c == '"':
        return _parse_string(cur)
    if c == "{":
        return _parse_table(cur)
    if c == "-" or c.isdigit():
        return _parse_number(cur)
    # 标识符：true / false / nil / 其它裸词
    return _parse_word(cur)


def _parse_string(cur: _Cursor) -> str:
    # 当前指向开引号
    s, n = cur.s, cur.n
    cur.i += 1  # 跳过 "
    out = []
    while cur.i < n:
        c = s[cur.i]
        if c == "\\":
            nxt = s[cur.i + 1] if cur.i + 1 < n else ""
            out.append({"n": "\n", "t": "\t", "r": "\r", '"': '"', "\\": "\\", "'": "'"}.get(nxt, nxt))
            cur.i += 2
            continue
        if c == '"':
            cur.i += 1
            return "".join(out)
        out.append(c)
        cur.i += 1
    raise LuaParseError("字符串未闭合")


def _parse_number(cur: _Cursor) -> Any:
    s = cur.s
    start = cur.i
    if s[cur.i] == "-":
        cur.i += 1
    while cur.i < cur.n and (s[cur.i].isdigit() or s[cur.i] in ".eExXabcdefABCDEF"):
        # 宽松匹配：整数、小数、科学计数、十六进制（0x..）
        cur.i += 1
    tok = s[start:cur.i]
    if "." in tok or "e" in tok or "E" in tok:
        return float(tok)
    try:
        return int(tok, 0) if tok.lower().startswith("0x") else int(tok)
    except ValueError:
        try:
            return float(tok)
        except ValueError:
            raise LuaParseError(f"无法解析数字: {tok!r}")


_WORD_OK = {"true": True, "false": False, "nil": None}


def _parse_word(cur: _Cursor) -> Any:
    s = cur.s
    start = cur.i
    while cur.i < cur.n and (s[cur.i].isalnum() or s[cur.i] == "_"):
        cur.i += 1
    tok = s[start:cur.i]
    if not tok:
        raise LuaParseError(f"意外字符 {cur.peek()!r} @ {cur.i}")
    return _WORD_OK.get(tok, tok)  # 未知裸词原样返回（数据里基本不出现）


def _parse_table(cur: _Cursor) -> dict | list:
    """解析 ``{...}``。

    返回 dict（有任何 ``key=``）或 list（纯数组）。BWIKI 数据里表都是 dict
    或数组，混合情况按是否有键决定；纯数组返回 list 便于 ``types`` 等字段用。
    """
    s, n = cur.s, cur.n
    cur.i += 1  # 跳过 {
    result: dict = {}
    array: list = []
    is_array = None  # None=未定, True=数组, False=dict
    auto_idx = 1
    while True:
        cur.ws()
        if cur.i >= n:
            raise LuaParseError("表未闭合")
        if cur.peek() == "}":
            cur.i += 1
            break
        # 解析一个 entry：可能是 key=val 或 纯 value（数组元素）
        key, val = _parse_entry(cur)
        if key is None:
            # 数组元素
            if is_array is False:
                raise LuaParseError("表混合数组与字典元素")
            is_array = True
            array.append(val)
        else:
            if is_array is True:
                raise LuaParseError("表混合数组与字典元素")
            is_array = False
            result[key] = val
        cur.ws()
        if cur.peek() == "," or cur.peek() == ";":
            cur.i += 1
            continue
        cur.ws()
        if cur.peek() == "}":
            cur.i += 1
            break
    if is_array:
        return array
    return result


def _parse_entry(cur: _Cursor) -> tuple[Any, Any]:
    """解析表中一个条目，返回 (key|None, value)。

    key 形态：
      - 裸标识符 ``at=``、``pet_000001=``
      - 带引号 ``["name"]=`` 或 ``"name"=``
      - 数字数组下标（本数据不出现，忽略）
    无 key 则为数组元素，返回 (None, value)。
    """
    save = cur.i
    # 尝试解析 key
    key = _try_parse_key(cur)
    if key is not _NO_KEY:
        cur.ws()
        if cur.peek() != "=":
            # 不是 key=value，回退当数组元素
            cur.i = save
            val = _parse_value(cur)
            return (None, val)
        cur.i += 1  # 吃掉 =
        cur.ws()
        val = _parse_value(cur)
        return (key, val)
    # 数组元素
    cur.i = save
    val = _parse_value(cur)
    return (None, val)


_NO_KEY = object()


def _try_parse_key(cur: _Cursor) -> Any:
    """尝试解析一个 key；无 key 返回 ``_NO_KEY``（不推进游标以外的副作用需要回退由调用方处理）。"""
    c = cur.peek()
    if c == "[":
        # ["str"] 或 [num]
        cur.i += 1
        cur.ws()
        if cur.peek() == '"':
            k = _parse_string(cur)
        else:
            k = _parse_number(cur)
        cur.ws()
        if cur.peek() != "]":
            raise LuaParseError(f"[] key 未闭合 @ {cur.i}")
        cur.i += 1
        return k
    if c == '"':
        return _parse_string(cur)
    # 裸标识符：字母/下划线/数字（如 pet_000001、at、heg）
    s = cur.s
    start = cur.i
    while cur.i < cur.n and (s[cur.i].isalnum() or s[cur.i] == "_"):
        cur.i += 1
    tok = s[start:cur.i]
    if not tok:
        return _NO_KEY
    return tok
