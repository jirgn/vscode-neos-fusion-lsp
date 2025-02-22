import * as NodeFs from 'fs'
import * as NodePath from 'path'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode'
import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/nodes/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { Command, CompletionItem, CompletionItemKind, InsertTextMode } from 'vscode-languageserver/node'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ResourceUriNode } from '../fusion/ResourceUriNode'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { NeosPackage } from '../neos/NeosPackage'
import { ExternalObjectStatement, NodeService } from '../common/NodeService'
import { AbstractCapability } from './AbstractCapability'
import { CapabilityContext, ParsedFileCapabilityContext } from './CapabilityContext'
import { TagNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagNode'
import { TagAttributeNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagAttributeNode'
import { findParent, getObjectIdentifier } from '../common/util'
import { Comment } from 'ts-fusion-parser/out/common/Comment'

// TODO: eel helper arguments
export class CompletionCapability extends AbstractCapability {

	static SuggestCommand: Command = {
		title: 'Trigger Suggest',

		command: 'editor.action.triggerSuggest'
	}

	protected run(context: CapabilityContext<AbstractNode>) {
		const { workspace, foundNodeByLine } = <ParsedFileCapabilityContext<AbstractNode>>context
		const completions = []
		if (foundNodeByLine) {
			const foundNode = foundNodeByLine.getNode()
			switch (true) {
				case foundNode instanceof TagNode:
					completions.push(...this.getTagNodeCompletions(workspace, <LinePositionedNode<TagNode>>foundNodeByLine))
					break
				case foundNode instanceof TagAttributeNode:
					completions.push(...this.getTagAttributeNodeCompletions(workspace, <LinePositionedNode<TagAttributeNode>>foundNodeByLine))
					break
				case foundNode instanceof ObjectStatement:
					completions.push(...this.getObjectStatementCompletions(workspace, <LinePositionedNode<ObjectStatement>>foundNodeByLine))
					break
				case foundNode instanceof FusionObjectValue:
				case foundNode instanceof PrototypePathSegment:
					completions.push(...this.getPrototypeCompletions(workspace, <LinePositionedNode<FusionObjectValue | PrototypePathSegment>>foundNodeByLine))
					break
				case foundNode instanceof ObjectNode:
					completions.push(...this.getFusionPropertyCompletionsForObjectNode(workspace, <LinePositionedNode<ObjectNode>>foundNodeByLine))
					break
				case foundNode instanceof ObjectPathNode:
					completions.push(...this.getEelHelperCompletionsForObjectPath(workspace, <LinePositionedNode<ObjectPathNode>>foundNodeByLine))
					completions.push(...this.getFusionPropertyCompletionsForObjectPath(workspace, <LinePositionedNode<ObjectPathNode>>foundNodeByLine))
					break
				case foundNode instanceof ResourceUriNode:
					completions.push(...this.getResourceUriCompletions(workspace, <LinePositionedNode<ResourceUriNode>>foundNodeByLine))
					break
				case foundNode instanceof Comment:
					completions.push(...this.getSemanticCommentCompletions(<LinePositionedNode<Comment>>foundNodeByLine))
					break
				default:
				// stub
			}
		}

		this.logVerbose(`Found ${completions.length} completions `)

		return completions
	}

	protected getTagNodeCompletions(workspace: FusionWorkspace, foundNode: LinePositionedNode<TagNode>) {
		const completions: CompletionItem[] = []

		const foundNodes = workspace.getNodesByType(PrototypePathSegment)
		if (!foundNodes) return null

		for (const fileNodes of foundNodes) {
			for (const fileNode of fileNodes.nodes) {
				const label = fileNode.getNode().identifier
				if (!completions.find(completion => completion.label === label)) {
					const foundNodeTagStart = { line: foundNode.getBegin().line, character: foundNode.getBegin().character + 1 }
					completions.push({
						label,
						kind: CompletionItemKind.Class,
						insertTextMode: InsertTextMode.adjustIndentation,
						insertText: label,
						textEdit: {
							insert: {
								start: foundNodeTagStart,
								end: foundNode.getEnd(),
							},
							replace: {
								start: foundNodeTagStart,
								end: { line: foundNode.getEnd().line, character: foundNode.getEnd().character + label.length },
							},
							newText: label
						}
					})
				}
			}
		}

		return completions
	}

	protected getTagAttributeNodeCompletions(workspace: FusionWorkspace, foundNode: LinePositionedNode<TagAttributeNode>) {
		const completions: CompletionItem[] = []
		const attributeNode = foundNode.getNode()

		if (attributeNode.value) return completions

		const tagNode = findParent(attributeNode, TagNode)
		if (tagNode !== undefined) {
			for (const statement of NodeService.getInheritedPropertiesByPrototypeName(tagNode["name"], workspace)) {
				completions.push({
					label: getObjectIdentifier(statement.statement),
					kind: CompletionItemKind.Property
				})
			}
		}

		return completions
	}

	protected getObjectStatementCompletions(workspace: FusionWorkspace, foundNode: LinePositionedNode<ObjectStatement>) {
		const node = foundNode.getNode()
		if (node.operation === null || node.operation["position"].begin !== node.operation["position"].end) return []

		return this.getPropertyDefinitionSegments(node, workspace)
	}

	protected getFusionPropertyCompletionsForObjectPath(workspace: FusionWorkspace, foundNode: LinePositionedNode<ObjectPathNode>): CompletionItem[] {
		const node = foundNode.getNode()
		const objectNode = node["parent"]
		if (!(objectNode instanceof ObjectNode)) return null


		if (objectNode.path.length === 1) {
			return [
				{
					label: 'props',
					insertText: 'props.',
					kind: CompletionItemKind.Keyword,
					command: CompletionCapability.SuggestCommand
				},
				{
					label: 'this',
					insertText: 'this.',
					kind: CompletionItemKind.Keyword,
					command: CompletionCapability.SuggestCommand
				}
			]
		}

		if ((objectNode.path[0]["value"] !== "this" && objectNode.path[0]["value"] !== "props") || objectNode.path.length === 1) {
			// TODO: handle context properties
			return []
		}

		return this.getPropertyDefinitionSegments(objectNode, workspace)
	}

	protected getPropertyDefinitionSegments(objectNode: ObjectNode | ObjectStatement, workspace?: FusionWorkspace) {
		const completions = []

		for (const segmentOrExternalStatement of NodeService.findPropertyDefinitionSegments(objectNode, workspace, true)) {
			const segment = segmentOrExternalStatement instanceof ExternalObjectStatement ? segmentOrExternalStatement.statement.path.segments[0] : segmentOrExternalStatement
			if (!(segment instanceof PathSegment)) continue
			if (segment.identifier === "renderer" || !segment.identifier) continue
			if (completions.find(completion => completion.label === segment.identifier)) continue
			completions.push({
				label: segment.identifier,
				kind: CompletionItemKind.Property
			})
		}

		return completions
	}

	protected getPrototypeCompletions(fusionWorkspace: FusionWorkspace, foundNode: LinePositionedNode<FusionObjectValue | PrototypePathSegment>): CompletionItem[] {
		const completions: CompletionItem[] = []

		const foundNodes = fusionWorkspace.getNodesByType(PrototypePathSegment)
		if (!foundNodes) return null

		for (const fileNodes of foundNodes) {
			for (const fileNode of fileNodes.nodes) {
				const label = fileNode.getNode().identifier
				if (!completions.find(completion => completion.label === label)) {
					completions.push(this.createCompletionItem(label, foundNode, CompletionItemKind.Class))
				}
			}
		}

		return completions
	}

	protected getFusionPropertyCompletionsForObjectNode(fusionWorkspace: FusionWorkspace, foundNode: LinePositionedNode<ObjectNode>): CompletionItem[] {
		const node = foundNode.getNode()
		if (node.path[0]["value"] !== "props") return null
		if (node.path.length !== 1) return null

		return this.getPropertyDefinitionSegments(node, fusionWorkspace)
	}

	protected getEelHelperCompletionsForObjectPath(fusionWorkspace: FusionWorkspace, foundNode: LinePositionedNode<ObjectPathNode>): CompletionItem[] {
		const node = foundNode.getNode()
		const objectNode = <ObjectNode>node["parent"]
		const linePositionedObjectNode = objectNode.linePositionedNode
		const fullPath = objectNode["path"].map(part => part["value"]).join(".")
		const completions: CompletionItem[] = []

		const eelHelpers = fusionWorkspace.neosWorkspace.getEelHelperTokens()
		for (const eelHelper of eelHelpers) {
			for (const method of eelHelper.methods) {
				if (method.getNormalizedName() === "allowsCallOfMethod") continue
				const fullName = eelHelper.name + "." + method.getNormalizedName()
				if (!fullName.startsWith(fullPath)) continue
				const completionItem = this.createCompletionItem(fullName, linePositionedObjectNode, CompletionItemKind.Method)
				completionItem.detail = method.description
				completions.push(completionItem)
			}
		}

		return completions
	}

	protected createCompletionItem(label: string, linePositionedNode: LinePositionedNode<AbstractNode>, kind: CompletionItemKind): CompletionItem {
		return {
			label,
			kind,
			insertTextMode: InsertTextMode.adjustIndentation,
			insertText: label,
			textEdit: {
				insert: linePositionedNode.getPositionAsRange(),
				replace: {
					start: linePositionedNode.getBegin(),
					end: { line: linePositionedNode.getEnd().line, character: linePositionedNode.getEnd().character + label.length },
				},
				newText: label
			}
		}
	}

	protected getResourceUriCompletions(workspace: FusionWorkspace, foundNode: LinePositionedNode<ResourceUriNode>): CompletionItem[] {
		const node = foundNode.getNode()

		const identifierMatch = /resource:\/\/(.*?)\//.exec(node["identifier"])
		if (identifierMatch === null) {
			return Array.from(workspace.neosWorkspace.getPackages().values()).map((neosPackage: NeosPackage) => {
				return {
					label: neosPackage.getPackageName(),
					kind: CompletionItemKind.Module,
					insertText: neosPackage.getPackageName() + '/',
					command: CompletionCapability.SuggestCommand
				}
			})
		}
		const packageName = identifierMatch[1]

		const neosPackage = workspace.neosWorkspace.getPackage(packageName)
		if (!neosPackage) return []

		const nextPath = NodePath.join(neosPackage["path"], "Resources", node.getRelativePath())
		if (!NodeFs.existsSync(nextPath)) return []

		const completions: CompletionItem[] = []
		const thingsInFolder = NodeFs.readdirSync(nextPath, { withFileTypes: true })
		for (const thing of thingsInFolder) {
			if (thing.isFile()) completions.push({
				label: thing.name,
				kind: CompletionItemKind.File,
				insertText: thing.name,
			})

			if (thing.isDirectory()) completions.push({
				label: thing.name,
				kind: CompletionItemKind.Folder,
				insertText: thing.name + '/',
				command: CompletionCapability.SuggestCommand
			})
		}

		return completions
	}

	protected getSemanticCommentCompletions(foundNode: LinePositionedNode<Comment>): CompletionItem[] {
		const completions: CompletionItem[] = []

		const node = foundNode.getNode()
		if (!node.value?.trim().startsWith("@")) return []

		for (const semanticComment of ['@fusion-ignore', '@fusion-ignore-block']) {
			const label = node.prefix === "//" ? `// ${semanticComment}` : `<!-- ${semanticComment} -->`

			completions.push({
				label,
				kind: CompletionItemKind.Class,
				insertTextMode: InsertTextMode.adjustIndentation,
				insertText: label,
				textEdit: {
					insert: {
						start: foundNode.getBegin(),
						end: foundNode.getEnd(),
					},
					replace: {
						start: foundNode.getBegin(),
						end: { line: foundNode.getEnd().line, character: foundNode.getEnd().character + label.length },
					},
					newText: label
				}
			})
		}



		return completions
	}
}