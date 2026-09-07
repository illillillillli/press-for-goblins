#!/usr/bin/env swift

import AppKit
import Foundation
import Vision

struct Finding: Codable {
    let file: String
    let text: String
    let confidence: Float
    let uppercase: String
}

struct Report: Codable {
    let ok: Bool
    let engine: String
    let files: [String]
    let findings: [Finding]
}

let files = Array(CommandLine.arguments.dropFirst())
guard !files.isEmpty else {
    FileHandle.standardError.write(Data("usage: swift scripts/human-text-ocr.swift <image> [...]\n".utf8))
    exit(2)
}

var findings: [Finding] = []
for file in files {
    guard let image = NSImage(contentsOfFile: file) else {
        findings.append(Finding(file: file, text: "unreadable raster", confidence: 0, uppercase: "uncertain"))
        continue
    }
    var rect = NSRect(origin: .zero, size: image.size)
    guard let cgImage = image.cgImage(forProposedRect: &rect, context: nil, hints: nil) else {
        findings.append(Finding(file: file, text: "unreadable raster", confidence: 0, uppercase: "uncertain"))
        continue
    }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    do {
        try VNImageRequestHandler(cgImage: cgImage).perform([request])
    } catch {
        findings.append(Finding(file: file, text: "ocr unavailable: \(error.localizedDescription)", confidence: 0, uppercase: "uncertain"))
        continue
    }
    for observation in request.results ?? [] {
        guard let candidate = observation.topCandidates(1).first else { continue }
        let expression = try NSRegularExpression(pattern: "\\p{Lu}{2,}")
        let range = NSRange(candidate.string.startIndex..., in: candidate.string)
        let matches = expression.matches(in: candidate.string, range: range).compactMap {
            Range($0.range, in: candidate.string).map { String(candidate.string[$0]) }
        }
        if !matches.isEmpty {
            findings.append(Finding(file: file, text: candidate.string, confidence: candidate.confidence, uppercase: matches.joined(separator: ",")))
        }
    }
}

let report = Report(ok: findings.isEmpty, engine: "apple-vision-ocr", files: files, findings: findings)
let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
FileHandle.standardOutput.write(try encoder.encode(report))
FileHandle.standardOutput.write(Data("\n".utf8))
if !findings.isEmpty { exit(1) }
