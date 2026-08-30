import asyncio
import httpx

async def test():
    query = """
    query {
      user1: matchedUser(username: "nanthishvaran_07") {
        username
      }
      user2: matchedUser(username: "this_user_definitely_does_not_exist_12345") {
        username
      }
    }
    """
    async with httpx.AsyncClient() as client:
        r = await client.post("https://leetcode.com/graphql", json={"query": query})
        print(r.text)

asyncio.run(test())
