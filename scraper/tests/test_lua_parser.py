"""Lua 表解析器回归测试（纯标准库 unittest，无需 pytest）。

用 BWIKI ``Module:PetData/*`` 的真实片段验证，确保 671 精灵 / 737 技能 /
264 进化链全量解析无误。

运行：``python3 -m unittest tests.test_lua_parser -v``
或：  ``python3 tests/test_lua_parser.py``
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from src.lua_parser import parse_table_module, LuaParseError  # noqa: E402

_FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures")
_HAS_FIXTURE = os.path.isdir(_FIXTURE)


class TestSynthetic(unittest.TestCase):
    """合成用例：覆盖各种语法边界。"""

    def test_simple_strings_and_numbers(self):
        d = parse_table_module('return {a="x", b=1, c=-5, d=1.5}')
        self.assertEqual(d, {"a": "x", "b": 1, "c": -5, "d": 1.5})

    def test_booleans_and_nil(self):
        d = parse_table_module("return {a=true, b=false, c=nil}")
        self.assertIs(d["a"], True)
        self.assertIs(d["b"], False)
        self.assertIsNone(d["c"])

    def test_trailing_comma_and_whitespace(self):
        d = parse_table_module('return {  a = "1" , b = "2" , }')
        self.assertEqual(d, {"a": "1", "b": "2"})

    def test_nested_table_and_array(self):
        d = parse_table_module('return {st={at=66,hp=65}, tp={"草系","武系"}}')
        self.assertEqual(d["st"], {"at": 66, "hp": 65})
        self.assertEqual(d["tp"], ["草系", "武系"])

    def test_string_escape(self):
        d = parse_table_module(r'return {d="带\"引号\"和\n换行"}')
        self.assertEqual(d["d"], '带"引号"和\n换行')

    def test_array_of_tables(self):
        d = parse_table_module('return {chain={{id="a",stage=1},{id="b",stage=2}}}')
        self.assertEqual(d["chain"], [{"id": "a", "stage": 1}, {"id": "b", "stage": 2}])

    def test_bracket_string_key(self):
        d = parse_table_module('return {["pet_000001"]={n="喵喵"}}')
        self.assertEqual(d["pet_000001"]["n"], "喵喵")

    def test_bareword_pet_key(self):
        d = parse_table_module('return {pet_000001={n="喵喵",tp={"草系"}}}')
        self.assertEqual(d["pet_000001"]["n"], "喵喵")
        self.assertEqual(d["pet_000001"]["tp"], ["草系"])

    def test_malformed_raises(self):
        with self.assertRaises(LuaParseError):
            parse_table_module("return {a=")


@unittest.skipUnless(_HAS_FIXTURE, "无 fixtures（运行 scraper 的 fetch-fixtures 后生成）")
class TestRealModule(unittest.TestCase):
    """真实模块全量解析回归。"""

    EXPECTED = {
        "Core": 671,          # pet_000001..000671
        "SkillCatalog": 737,  # skill 条目
        "Evolution": 264,     # evo 进化链
        "Handbook": None,     # 仅校验 dict，数量随版本变
        "Index": None,
    }

    def test_parse_each_real_module(self):
        for mod, expected in self.EXPECTED.items():
            with self.subTest(module=mod):
                path = os.path.join(_FIXTURE, f"Module_PetData_{mod}.txt")
                with open(path, encoding="utf-8") as f:
                    d = parse_table_module(f.read())
                self.assertIsInstance(d, dict, f"{mod} 顶层应为 dict")
                if expected:
                    self.assertGreaterEqual(
                        len(d), expected, f"{mod} 条目数 {len(d)} < 预期 {expected}"
                    )

    def test_core_pet_shape(self):
        """Core 中 pet_000001（喵喵）字段形态校验。"""
        with open(os.path.join(_FIXTURE, "Module_PetData_Core.txt"), encoding="utf-8") as f:
            d = parse_table_module(f.read())
        pet = d["pet_000001"]
        self.assertEqual(pet["n"], "喵喵")
        self.assertEqual(pet["tp"], ["草系"])
        self.assertEqual(pet["st"], {"at": 66, "df": 49, "hp": 65, "sa": 66, "sd": 91, "se": 33})
        self.assertEqual(pet["sg"], 1)
        self.assertIs(pet["hs"], False)
        self.assertEqual(pet["fs"], "skill_000003")


if __name__ == "__main__":
    unittest.main(verbosity=2)
